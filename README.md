# ParkhyaConnect API

**Parkhya Connect** is a communication and project management platform for organizations. It enables direct messaging, group chats, project collaboration, and task management in one place.  

---

## **Tech Stack**
- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, Kafka, Socket.io  
- **Frontend:** React.js  
- **Real-time Communication:** Kafka, Socket.io  
- **Database ORM:** Prisma  

---

## **Project Structure**
The project follows a modular structure, with each controller, router, and schema wrapped in an `index.ts` file for better organization.  

```plaintext

/parkhyaconnect-api
│── /app                 # Main application directory
│   │── /config          # Configuration files (DB, environment variables, Kafka, etc.)
│   │   ├── db.ts        # PostgreSQL database connection
│   │   ├── env.ts       # Environment variable setup
│   │   ├── kafka.ts     # Kafka producer/consumer setup
│   │── /controllers     # Business logic handlers
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── message.ts
│   │   ├── index.ts  # Exports all controllers
│   │── /middlewares     # Custom middleware (auth, logging, error handling, etc.)
│   │   ├── auth.ts
│   │   ├── error.ts
│   │── /models          # Database models (Prisma or raw queries)
│   │   ├── user.ts
│   │   ├── message.ts
│   │   ├── index.ts  # Exports all models
│   │── /routes          # API route definitions
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── message.ts
│   │   ├── index.ts  # Exports all routes
│   │── /services        # Service layer for business logic
│   │   ├── user.service.ts
│   │   ├── message.service.ts
│   │   ├── index.ts  # Exports all services
│   │── /utils           # Utility functions (helpers, logging, etc.)
│   │   ├── logger.ts
│   │   ├── responseHandler.ts
│   │── /validators      # Input validation (Joi, Express-validator, etc.)
│   │   ├── auth.validator.ts
│   │   ├── user.validator.ts
│   │── app.ts           # Express app setup
│   │── server.ts        # Server entry point
│── /prisma              # Prisma-related files
│   ├── schema.prisma    # Prisma schema
│   ├── migrations/      # Database migrations
│── /kafka               # Kafka producer/consumer scripts
│   ├── producer.ts
│   ├── consumer.ts
│── /tests               # Unit and integration tests
│   ├── user.test.ts
│   ├── message.test.ts
│── /types               # TypeScript types/interfaces
│   ├── user.d.ts
│   ├── message.d.ts
│── tsconfig.json        # TypeScript configuration
│── .env                 # Environment variables
│── .gitignore           # Git ignore file
│── package.json         # Node.js dependencies
│── README.md            # Project documentation
