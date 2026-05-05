import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env.js';

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Photo Studio Delivery Automation API',
      version: '1.0.0',
      description: 'Authenticated API for the e-commerce photography studio delivery workflow, including clients, projects, previews, logs, and automation controls.'
    },
    servers: [
      {
        url: env.APP_URL,
        description: 'Current backend server'
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints for dashboard and API access.'
      },
      {
        name: 'Studio',
        description: 'Studio delivery automation operations.'
      },
      {
        name: 'Tracking',
        description: 'Email open and click tracking routes.'
      }
    ],
    components: {
      schemas: {
        StudioClientInput: {
          type: 'object',
          required: ['name', 'brandName', 'email'],
          properties: {
            name: { type: 'string', example: 'Nora Patel' },
            brandName: { type: 'string', example: 'Acme Apparel' },
            email: { type: 'string', format: 'email', example: 'nora@acme.example' },
            phone: { type: 'string', example: '+91-9999999999', nullable: true },
            priorityTier: { type: 'string', example: 'STANDARD' },
            notes: { type: 'string', nullable: true }
          }
        },
        StudioProjectInput: {
          type: 'object',
          required: ['clientId', 'projectCode', 'title', 'driveFolderLink'],
          properties: {
            clientId: { type: 'string', example: '68100a3f2b2f4c9f0f7d4001' },
            projectCode: { type: 'string', example: 'APR-TEST-001' },
            title: { type: 'string', example: 'Summer collection hero set' },
            status: { type: 'string', enum: ['EDITING', 'REVIEW', 'COMPLETED', 'HOLD'], example: 'COMPLETED' },
            requiresFollowUp: { type: 'boolean', example: false },
            followUpSentAt: { type: 'string', format: 'date-time', nullable: true },
            driveFolderLink: { type: 'string', format: 'uri', example: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz12345' },
            deliveryTemplateTone: { type: 'string', enum: ['FORMAL', 'FRIENDLY', 'PREMIUM'], example: 'PREMIUM' },
            deadlineAt: { type: 'string', format: 'date-time', nullable: true },
            notes: { type: 'string', nullable: true }
          }
        },
        ManualSendInput: {
          type: 'object',
          properties: {
            tone: { type: 'string', enum: ['FORMAL', 'FRIENDLY', 'PREMIUM'], example: 'PREMIUM' },
            subject: { type: 'string', example: 'Your Acme Apparel delivery is ready' },
            message: { type: 'string', example: 'Hi Nora, your final delivery is ready in Google Drive.' },
            includeRevisionCta: { type: 'boolean', example: true },
            includeFeedbackCta: { type: 'boolean', example: true },
            force: { type: 'boolean', example: false }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/modules/auth/auth.routes.js', './src/modules/studio/studio.routes.js']
});
