
# CrwdCtrl
=======
# 🎉 CrwdCtrl - Complete Festival Management Platform

CrwdCtrl is a comprehensive digital platform that bridges the gap between festival organizers and participants, enabling seamless event discovery, registration, and management across educational institutions.

## 🚀 Tech Stack & Architecture

### Frontend Stack
- **React 19.1.1** - Modern UI library with latest features
- **Vite 7.1.7** - Ultra-fast build tool and development server
- **TypeScript Support** - Type-safe development environment
- **ESLint** - Code quality and consistency enforcement
- **Modern ES Modules** - Latest JavaScript standards

### Backend Stack
- **Node.js** - JavaScript runtime for server-side development
- **Express.js 5.1.0** - Fast, minimal web framework
- **MongoDB** - NoSQL database for flexible data storage
- **Mongoose 8.19.3** - MongoDB ODM for data modeling and validation

### Authentication & Security
- **JWT (JSON Web Tokens)** - Stateless authentication system
- **bcryptjs** - Password hashing and security
- **Custom Auth Middleware** - Route protection and user verification

### Cloud & External Services
- **Firebase 12.5.0** - Real-time database and cloud functions
- **Firebase Admin SDK** - Server-side Firebase operations
- **Axios** - HTTP client for external API integrations

### Development Tools
- **Nodemon** - Auto-restart development server
- **dotenv** - Environment variable management
- **ESLint** - Code linting and formatting

## 🎯 Core Features & Implementations

### 👤 User Management System
- **Multi-role Authentication**: Students, Festival Organizers
- **Secure Registration/Login**: Email and phone-based authentication
- **Profile Management**: Comprehensive user profiles with college details
- **JWT-based Sessions**: Stateless authentication for scalability

### 🎪 Festival Management
- **CRUD Operations**: Complete festival lifecycle management
- **Multi-category Support**: Cultural, Technical, Sports, Management events
- **Event & Competition Management**: Nested event structures within festivals
- **Rich Media Support**: Image galleries and promotional content
- **Location & Date Management**: Comprehensive scheduling system

### 📱 Student Features
- **Festival Discovery**: Browse and search festivals by category/location
- **Registration System**: Easy signup for festivals, events, and competitions
- **Personal Dashboard**: Track registered events and participation history
- **College Integration**: Link profiles with educational institutions

### 📊 Data Management
- **MongoDB Collections**:
  - Users (Base user information)
  - Students (Extended student profiles)
  - FestOrganizers (Festival and event data)
- **Relationship Modeling**: Proper data relationships with population queries
- **Indexing**: Optimized database queries for performance

## 🏗️ Project Architecture

### Backend Structure
```
backend/src/
├── server.js              # Application entry point & Express setup
├── config/db.js          # MongoDB connection configuration
├── controllers/           # Business logic & request handling
│   ├── userController.js       # User auth & profile management
│   ├── studentController.js    # Student-specific operations  
│   └── festOrganizerController.js # Festival management
├── models/               # Database schemas & data models
│   ├── usermodel.js           # Base user schema
│   ├── student&participant.js # Student profile schema
│   └── fest_organizer_model.js # Festival data schema
├── routes/               # API endpoint definitions
│   ├── userroute.js          # User authentication routes
│   ├── studentroute.js       # Student dashboard routes
│   ├── festOrganizerRoute.js # Festival management routes
│   └── publicFestRoute.js    # Public festival discovery
├── middleware/           # Custom middleware functions
│   └── authmiddleware.js     # JWT authentication middleware
└── service/              # External service integrations (Future)
```

### Frontend Structure
```
frontend/src/
├── main.jsx              # React application entry point
├── App.jsx               # Main application component
├── assets/               # Static assets and images
└── components/           # Reusable React components (Future)
```

## 🔧 Setup & Installation

### Prerequisites
- **Node.js** (v16 or higher)
- **MongoDB** (Local or Atlas)
- **npm** or **yarn** package manager

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Start production server
npm start
```

### Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🌐 Environment Configuration

### Backend Environment Variables (.env)
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/crwdctrl
# or for MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/crwdctrl

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Configuration (Optional)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# External API Keys (Future Integration)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 📋 API Endpoints Overview

### Authentication Routes
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User authentication
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Student Routes (Protected)
- `POST /api/students/profile` - Create/update student profile
- `GET /api/students/profile` - Get student profile
- `GET /api/students/registered-fests` - Get registered festivals
- `POST /api/students/register-fest/:festId` - Register for festival

### Festival Organizer Routes (Protected)
- `POST /api/fest-organizer/create` - Create new festival
- `GET /api/fest-organizer/my-fests` - Get organizer's festivals
- `PUT /api/fest-organizer/update/:festId` - Update festival
- `DELETE /api/fest-organizer/delete/:festId` - Delete festival
- `POST /api/fest-organizer/add-event` - Add event to festival
- `POST /api/fest-organizer/add-competition` - Add competition

### Public Routes
- `GET /api/public/fests` - Browse all festivals
- `GET /api/public/fests/search` - Search festivals
- `GET /api/public/fests/:festId` - Get festival details
- `GET /api/public/fests/category/:type` - Get festivals by category

## 🔒 Security Implementation

### Authentication Flow
1. **User Registration**: Password hashing with bcryptjs
2. **JWT Token Generation**: Secure token creation with expiration
3. **Middleware Protection**: Route-level authentication checks
4. **Role-based Access**: Different permissions for students and organizers

### Data Validation
- **Mongoose Schemas**: Server-side data validation
- **Input Sanitization**: Protection against malicious input
- **MongoDB Indexing**: Optimized queries and unique constraints

## 🚀 Key Features In Detail

### Festival Discovery System
- **Advanced Search**: Filter by category, location, date, college
- **Public API**: Unauthenticated access for festival browsing
- **Rich Metadata**: Detailed festival information with galleries
- **Real-time Updates**: Dynamic content updates

### Registration Management
- **Nested Registration**: Festivals → Events → Competitions hierarchy
- **Capacity Management**: Limited seats with automatic updates
- **Registration Tracking**: Complete audit trail of user registrations
- **Notification System**: Ready for email/SMS integration

### Analytics & Reporting
- **Registration Statistics**: Track participation across events
- **Popular Events**: Data-driven insights for organizers
- **Performance Metrics**: Festival success measurement
- **Export Capabilities**: Data export for external analysis

## 🔄 Development Workflow

### Backend Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run in production mode
npm start
```

### Frontend Development
```bash
# Start Vite development server
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📦 Deployment Strategy

### Backend Deployment
- **Platform**: Heroku, DigitalOcean, or AWS EC2
- **Database**: MongoDB Atlas for production
- **Environment**: Production environment variables
- **Process Management**: PM2 for Node.js process management

### Frontend Deployment
- **Platform**: Vercel, Netlify, or AWS S3 + CloudFront
- **Build Process**: Optimized Vite production build
- **CDN**: Global content delivery for performance

## 🔮 Future Enhancements

### Phase 2 Features
- **Payment Integration**: Razorpay/Stripe for paid events
- **Real-time Chat**: WebSocket-based communication
- **Push Notifications**: PWA with notification support
- **Mobile App**: React Native implementation
- **Advanced Analytics**: Dashboard with charts and insights

### Technical Improvements
- **Microservices**: Service decomposition for scalability
- **Caching**: Redis implementation for performance
- **File Upload**: Cloudinary integration for media management
- **Testing**: Comprehensive test suite with Jest
- **CI/CD**: Automated deployment pipelines

## 📞 Support & Documentation

- **API Documentation**: See [API_DOCUMENTATION.md](./backend/API_DOCUMENTATION.md)
- **MVP Requirements**: [CRWDCTRL (MVP).pdf](./CRWDCTRL%20(MVP).pdf)
- **Issues**: GitHub Issues for bug reports and feature requests
- **Contributing**: Fork, feature branch, and pull request workflow

## 📄 License

This project is part of the CrwdCtrl platform - All rights reserved.

