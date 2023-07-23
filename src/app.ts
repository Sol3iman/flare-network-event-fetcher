// src/app.ts
import express, { Request, Response } from 'express';
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Op } from "sequelize";
import { PriceFinalized, PriceRevealed } from '../databaseModel/mySqlDatabaseModel';

const app = express();

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Flare Network Event Fetcher API",
            version: "1.0.0",
            description: "API for fetching event data from a Flare Network Service"
        },
        servers: [
            {
                url: "http://localhost:3000"
            }
        ]
    },
    apis: ["./src/server.ts"]
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/prices-for-symbol', async (req: Request, res: Response) => {
    const { startEpochId, endEpochId, symbol, limit, offset } = req.query;

    const prices = await PriceFinalized.findAll({
        where: {
            epochId: {
                [Op.between]: [Number(startEpochId), Number(endEpochId)]
            },
            symbol
        },
        order: [
            ['epochId', 'ASC']
        ],
        limit: Number(limit),
        offset: Number(offset)
    });

    res.json(prices);
});

app.get('/votes-of/:voterAddress', async (req: Request, res: Response) => {
    const { startEpochId, endEpochId, symbol, limit, offset } = req.query;
    const { voterAddress } = req.params;

    const votes = await PriceRevealed.findAll({
        where: {
            voter: voterAddress,
            epochId: {
                [Op.between]: [Number(startEpochId), Number(endEpochId)]
            },
            symbol
        },
        order: [
            ['epochId', 'ASC']
        ],
        limit: Number(limit),
        offset: Number(offset)
    });

    res.json(votes);
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
