# Bitespeed Identity Reconciliation API

A REST API for identity reconciliation, built with Node.js, Express, and PostgreSQL.

## Project Structure
```
bitespeed-identity/
├── config/
│   └── db.js
├── controllers/
│   └── contactController.js
├── db/
│   └── init.sql
├── routes/
│   └── contactRoutes.js
├── services/
│   └── contactService.js
├── tests/
│   └── Identify.postman_collection.json
├── app.js
├── server.js
├── package.json
└── README.md
```

## Setup and Local Development
1. Run `npm install`
2. Set up a local PostgreSQL database and run the table creation script located at `db/init.sql`.
3. Create a `.env` file in the root directory and add your database connection URI: `DATABASE_URL=postgres://user:password@localhost:5432/bitespeed`.
4. Run `node server.js` to start the server.

## 🚀 Live Deployment

Base URL:
https://bitespeed-identity-api-jhyb.onrender.com

Endpoint:
POST https://bitespeed-identity-api-jhyb.onrender.com/identify


## API Endpoints

### POST `/identify`
Reconciles contacts by email or phone number.

**Body:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```
At least one of `email` or `phoneNumber` must be present.

- If the contact does not exist, a new primary contact is created.
- If the contact exists, it fetches all related linked contacts (primary + secondary) and determines the oldest contact, converting others to secondary contacts if needed.
- If the incoming request contains new information that doesn't exist in the network, a new secondary contact is created.

**Example Response:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["mcfly@hillvalley.edu", "biff@hillvalley.edu"],
    "phoneNumbers": ["123456", "987654"],
    "secondaryContactIds": [2, 3]
  }
}
```
