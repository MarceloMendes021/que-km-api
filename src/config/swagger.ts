import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Que KM é Esse? — API",
      version: "1.0.0",
      description: "API REST para controle financeiro de motoristas autônomos.",
    },
    servers: [
      {
        url: "https://que-km-api.onrender.com",
        description: "Produção",
      },
      {
        url: "http://localhost:3000",
        description: "Desenvolvimento",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
