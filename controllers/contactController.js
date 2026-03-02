const contactService = require('../services/contactService');

async function identifyContact(req, res, next) {
    try {
        const { email, phoneNumber } = req.body;

        if (!email && !phoneNumber) {
            return res.status(400).json({
                error: "At least one of 'email' or 'phoneNumber' must be provided."
            });
        }

        const emailStr = email ? String(email) : null;
        const phoneStr = phoneNumber ? String(phoneNumber) : null;

        const result = await contactService.reconcileContact(emailStr, phoneStr);

        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    identifyContact
};
