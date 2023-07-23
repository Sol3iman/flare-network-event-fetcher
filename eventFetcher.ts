import { ethers, providers } from 'ethers';
import { PriceRevealed, PriceFinalized } from './databaseModel/mySqlDatabaseModel';
import { abi as priceSubmitterContractABI } from './ABIs/priceSubmitterContractABI.json'
import { abi as ftsoManagerABI } from './ABIs/FtsoManagerABI.json'
import { abi as ftsoContractABI } from './ABIs/FtsoContractABI.json'
import fs from 'fs';
import path from 'path';

interface IPriceRevealedEvent {
    voter: string;
    epochId: number;
    price: number;
    timestamp: number;
    votePowerNat: number;
    votePowerAsset: number;
}

interface IPriceFinalizedEvent {
    epochId: number;
    price: number;
    rewardedFtso: boolean;
    lowIQRRewardPrice: number;
    highIQRRewardPrice: number;
    lowElasticBandRewardPrice: number;
    highElasticBandRewardPrice: number;
    finalizationType: number;
    timestamp: number;
}

const ABI_FTSO_MANAGER = ftsoContractABI // ABI of the FtsoManager contract
const ABI_FTSO = ftsoManagerABI // ABI of the Ftso contract
const ABI_PRICE_SUBMITTER = priceSubmitterContractABI // ABI of the PriceSubmitter contract

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class FlareNetworkService {
    private provider: providers.Provider;
    private priceSubmitterContract: ethers.Contract;
    private ftsoManagerContract: ethers.Contract;
    private ftsoContracts: ethers.Contract[] = [];
    private lastBlock: number = 10999000; // We will start from block 10999000

    constructor(private rpcUrl: string, private priceSubmitterAddress: string) {
        this.provider = new providers.JsonRpcProvider(rpcUrl);
        this.priceSubmitterContract = new ethers.Contract(priceSubmitterAddress, ABI_PRICE_SUBMITTER, this.provider);

        // Load the lastBlock from a file, if it exists.
        // If the file does not exist, use the default last block.
        const lastBlockFilePath = path.resolve(__dirname, 'lastBlock.txt');
        if (fs.existsSync(lastBlockFilePath)) {
            this.lastBlock = Number(fs.readFileSync(lastBlockFilePath, 'utf-8'));
        } else {
            this.lastBlock = this.lastBlock;
        }
    }

    private async init(): Promise<void> {
        try {
            // get the FtsoManager contract address from the PriceSubmitter contract
            const ftsoManagerAddress = await this.priceSubmitterContract.getFtsoManager();
            this.ftsoManagerContract = new ethers.Contract(ftsoManagerAddress, ABI_FTSO_MANAGER, this.provider);

            // get all the Ftso contract addresses
            const ftsoAddresses = await this.ftsoManagerContract.getFtsos();

            // create contract instances for each Ftso contract
            this.ftsoContracts = ftsoAddresses.map(address => new ethers.Contract(address, ABI_FTSO, this.provider));
        } catch (error) {
            console.error("Error in initialization: ", error);
            throw error;
        }
    }

    public async fetchEvents(RATE_LIMIT_DELAY: number): Promise<{ priceRevealed: IPriceRevealedEvent[], priceFinalized: IPriceFinalizedEvent[] }[]> {
        try {
            await this.init();
            const currentBlock = await this.provider.getBlockNumber();

            // Fetching events for each FTSO contract
            const results = await Promise.all(this.ftsoContracts.map(async (contract) => {
                // Fetching PriceRevealed events
                const priceRevealedFilter = contract.filters.PriceRevealed();
                const priceRevealedEvents = await contract.queryFilter(priceRevealedFilter, this.lastBlock, currentBlock);
                console.log('PriceRevealed events for contract ', contract.address, ': ', priceRevealedEvents);

                for (const event of priceRevealedEvents) {
                    const eventData = contract.interface.parseLog(event);
                    try {
                        await PriceRevealed.create({
                            voter: eventData.args.voter,
                            epochId: eventData.args.epochId.toNumber(),
                            price: eventData.args.price.toNumber(),
                            timestamp: new Date(eventData.args.timestamp.toNumber() * 1000), // Convert from Unix timestamp to JS date
                            symbol: eventData.args.symbol
                        })
                    } catch (err) {
                        console.error("Error saving PriceRevealed event to database:", err);
                    };
                }


                // Fetching PriceFinalized events
                const priceFinalizedFilter = contract.filters.PriceFinalized();
                const priceFinalizedEvents = await contract.queryFilter(priceFinalizedFilter, this.lastBlock, currentBlock);
                console.log('PriceFinalized events for contract ', contract.address, ': ', priceFinalizedEvents);

                for (const event of priceFinalizedEvents) {
                    const eventData = contract.interface.parseLog(event);
                    try {
                        await PriceFinalized.create({
                            epochId: eventData.args.epochId.toNumber(),
                            price: eventData.args.price.toNumber(),
                            rewardedFtso: eventData.args.rewardedFtso,
                            lowIQRRewardPrice: eventData.args.lowIQRRewardPrice.toNumber(),
                            highIQRRewardPrice: eventData.args.highIQRRewardPrice.toNumber(),
                            lowElasticBandRewardPrice: eventData.args.lowElasticBandRewardPrice.toNumber(),
                            highElasticBandRewardPrice: eventData.args.highElasticBandRewardPrice.toNumber(),
                            finalizationType: eventData.args.finalizationType,
                            timestamp: new Date(eventData.args.timestamp.toNumber() * 1000), // Convert from Unix timestamp to JavaScript date
                            symbol: eventData.args.symbol
                        })
                    } catch (err) {
                        console.error("Error saving PriceFinalized event to database:", err);
                    }
                }

                // Sleep for a specified time to avoid hitting rate limit of flare rpc url (not sure what the rate limit is right now)
                await sleep(RATE_LIMIT_DELAY);

                return {
                    priceRevealed: priceRevealedEvents.flatMap(event => {
                        if (event.args) {
                            const args = event.args;
                            return [{
                                voter: args.voter,
                                epochId: args.epochId.toNumber(),
                                price: args.price.toNumber(),
                                timestamp: args.timestamp.toNumber(),
                                votePowerNat: args.votePowerNat.toNumber(),
                                votePowerAsset: args.votePowerAsset.toNumber(),
                            } as IPriceRevealedEvent];
                        }
                        return [];
                    }),
                    priceFinalized: priceFinalizedEvents.flatMap(event => {
                        if (event.args) {
                            const args = event.args;
                            return [{
                                epochId: args.epochId.toNumber(),
                                price: args.price.toNumber(),
                                rewardedFtso: args.rewardedFtso,
                                lowIQRRewardPrice: args.lowIQRRewardPrice.toNumber(),
                                highIQRRewardPrice: args.highIQRRewardPrice.toNumber(),
                                lowElasticBandRewardPrice: args.lowElasticBandRewardPrice.toNumber(),
                                highElasticBandRewardPrice: args.highElasticBandRewardPrice.toNumber(),
                                finalizationType: args.finalizationType.toNumber(),
                                timestamp: args.timestamp.toNumber(),
                            } as IPriceFinalizedEvent];
                        }
                        return [];
                    }),
                }
            }));

            // update the last fetched block
            this.lastBlock = currentBlock;

            // Save the last block to a file for persistence, ideally use a db or something like redis for this 
            const lastBlockFilePath = path.resolve(__dirname, 'lastBlock.txt');
            fs.writeFileSync(lastBlockFilePath, this.lastBlock.toString());

            return results;
        } catch (error) {
            console.error("Error in fetching events: ", error);
            throw error;
        }
    }


    async startFetchingEvents(interval: number, rateLimitDelay: number) {
        const RATE_LIMIT_DELAY = rateLimitDelay;
        // First time fetch
        await this.fetchEvents(RATE_LIMIT_DELAY);
        // Then fetch every `interval` in milliseconds
        setInterval(async () => {
            try {
                await this.fetchEvents(RATE_LIMIT_DELAY);
            } catch (error) {
                console.error('Error fetching events: ', error);
            }
        }, interval);
    }
}

const RPC_URL = process.env.FLARE_RPC_URL;
const PRICE_SUBMITTER_ADDRESS = process.env.PRICE_SUBMITTER_ADDRESS;

const flareNetworkService = new FlareNetworkService(RPC_URL || '', PRICE_SUBMITTER_ADDRESS || '');

// Start continuous fetching every 5 seconds
flareNetworkService.startFetchingEvents(5000, 2000).then(events => {
    console.log(events);
}).catch(error => {
    console.error('Error fetching events: ', error);
});

