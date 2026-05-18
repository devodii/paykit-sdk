import {
  loadEnv,
  defineConfig,
  Modules,
} from '@medusajs/framework/utils';
import { gopay } from '@paykit-sdk/gopay';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },
  modules: [
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: '@paykit-sdk/medusajs',
            id: 'gopay',
            options: {
              provider: gopay(),
              debug: true,
              amountToCentsMultiplier: 100,
            },
          },
        ],
      },
    },
  ],
});
