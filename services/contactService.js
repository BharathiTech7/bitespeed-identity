const db = require('../config/db');

async function reconcileContact(email, phoneNumber) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 1. Find directly matching contacts
        let query = `SELECT id FROM "Contact" WHERE `;
        const conditions = [];
        const params = [];
        if (email) {
            params.push(email);
            conditions.push(`"email" = $${params.length}`);
        }
        if (phoneNumber) {
            params.push(phoneNumber);
            conditions.push(`"phoneNumber" = $${params.length}`);
        }
        query += conditions.join(' OR ');

        const { rows: matchedContacts } = await client.query(query, params);

        // 2. If NO match, create a primary contact entirely
        if (matchedContacts.length === 0) {
            const insertQuery = `
        INSERT INTO "Contact" ("email", "phoneNumber", "linkPrecedence")
        VALUES ($1, $2, 'primary')
        RETURNING *
      `;
            const { rows: newContactRows } = await client.query(insertQuery, [email, phoneNumber]);
            await client.query('COMMIT');

            const newContact = newContactRows[0];
            return {
                contact: {
                    primaryContactId: newContact.id,
                    emails: newContact.email ? [newContact.email] : [],
                    phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                    secondaryContactIds: []
                }
            };
        }

        const matchedIds = matchedContacts.map(c => c.id);

        // 3. Find ALL connected contacts recursively
        const networkQuery = `
      WITH RECURSIVE ConnectedContacts AS (
        -- Base case: Starts from the contacts that matched directly
        SELECT id, "phoneNumber", "email", "linkedId", "linkPrecedence", "createdAt", "updatedAt"
        FROM "Contact"
        WHERE id = ANY($1)

        UNION

        -- Recursive step: find contacts linked to anyone in ConnectedContacts, OR anyone who links TO ConnectedContacts
        SELECT c.id, c."phoneNumber", c."email", c."linkedId", c."linkPrecedence", c."createdAt", c."updatedAt"
        FROM "Contact" c
        INNER JOIN ConnectedContacts cc ON c.id = cc."linkedId" OR c."linkedId" = cc.id
      )
      SELECT * FROM ConnectedContacts
      ORDER BY "createdAt" ASC;
    `;
        const { rows: networkContacts } = await client.query(networkQuery, [matchedIds]);

        // 4. Explicitly find the oldest primary
        const allPrimaries = networkContacts.filter(c => c.linkPrecedence === 'primary');
        // Sorted by createdAt just in case (networkContacts is already ordered though)
        allPrimaries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Fallback to the oldest contact if NO primary is somehow found
        const ultimatePrimary = allPrimaries.length > 0 ? allPrimaries[0] : networkContacts[0];

        // 5. Update other primaries to secondary if there are multiple primaries
        const otherPrimaries = allPrimaries.slice(1);
        if (otherPrimaries.length > 0) {
            const otherPrimaryIds = otherPrimaries.map(p => p.id);

            // Update other primaries to point to ultimatePrimary
            await client.query(`
        UPDATE "Contact"
        SET "linkPrecedence" = 'secondary', "linkedId" = $1, "updatedAt" = NOW()
        WHERE id = ANY($2)
      `, [ultimatePrimary.id, otherPrimaryIds]);

            // Update local copy for consistent response formatting without another SELECT
            networkContacts.forEach(c => {
                if (otherPrimaryIds.includes(c.id)) {
                    c.linkPrecedence = 'secondary';
                    c.linkedId = ultimatePrimary.id;
                }
            });
        }

        // Connect any stray secondaries directly to the ultimate primary to keep a flat hierarchy 
        // (As requested: "Update linkedId to oldest primary")
        const secondariesToUpdate = networkContacts.filter(c => c.id !== ultimatePrimary.id && c.linkedId !== ultimatePrimary.id);
        if (secondariesToUpdate.length > 0) {
            const secondaryIdsToUpdate = secondariesToUpdate.map(c => c.id);

            await client.query(`
        UPDATE "Contact"
        SET "linkedId" = $1, "updatedAt" = NOW()
        WHERE id = ANY($2)
      `, [ultimatePrimary.id, secondaryIdsToUpdate]);

            networkContacts.forEach(c => {
                if (secondaryIdsToUpdate.includes(c.id)) {
                    c.linkedId = ultimatePrimary.id;
                }
            });
        }

        // 6. Check if we need to insert a new secondary contact
        const networkEmails = new Set(networkContacts.map(c => c.email).filter(Boolean));
        const networkPhones = new Set(networkContacts.map(c => c.phoneNumber).filter(Boolean));

        let isNewInfo = false;
        if (email && !networkEmails.has(email)) isNewInfo = true;
        if (phoneNumber && !networkPhones.has(phoneNumber)) isNewInfo = true;

        let newlyCreatedSecondary = null;
        if (isNewInfo) {
            const insertSecQuery = `
        INSERT INTO "Contact" ("email", "phoneNumber", "linkedId", "linkPrecedence")
        VALUES ($1, $2, $3, 'secondary')
        RETURNING *
      `;
            const { rows: secRows } = await client.query(insertSecQuery, [email, phoneNumber, ultimatePrimary.id]);
            newlyCreatedSecondary = secRows[0];
            networkContacts.push(newlyCreatedSecondary);
        }

        await client.query('COMMIT');

        // 7. Format response
        // Primary's info must be first
        const emails = [];
        const phones = [];
        const secondaryContactIds = [];

        if (ultimatePrimary.email) emails.push(ultimatePrimary.email);
        if (ultimatePrimary.phoneNumber) phones.push(ultimatePrimary.phoneNumber);

        for (const c of networkContacts) {
            if (c.id === ultimatePrimary.id) continue;

            if (c.email && !emails.includes(c.email)) {
                emails.push(c.email);
            }
            if (c.phoneNumber && !phones.includes(c.phoneNumber)) {
                phones.push(c.phoneNumber);
            }
            secondaryContactIds.push(c.id);
        }

        return {
            contact: {
                primaryContactId: ultimatePrimary.id,
                emails,
                phoneNumbers: phones,
                secondaryContactIds
            }
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    reconcileContact
};
