import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize('database', 'username', 'password', {
    host: 'localhost',
    dialect: 'mysql'
});


const PriceRevealed = sequelize.define('PriceRevealed', {
    voter: {
        type: DataTypes.STRING,
        allowNull: false
    },
    epochId: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    price: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
});

const PriceFinalized = sequelize.define('PriceFinalized', {
    epochId: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    price: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    rewardedFtso: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    lowIQRRewardPrice: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    highIQRRewardPrice: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    lowElasticBandRewardPrice: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    highElasticBandRewardPrice: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    finalizationType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
});

export { PriceRevealed, PriceFinalized };
