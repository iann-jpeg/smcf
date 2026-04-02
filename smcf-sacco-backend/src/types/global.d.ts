/// <reference types="node" />

// Global type declarations for Node.js environment
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    PORT?: string;
    MONGODB_URI: string;
    JWT_SECRET: string;
    FRONTEND_URL?: string;
  }
}
