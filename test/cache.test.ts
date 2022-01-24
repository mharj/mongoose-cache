process.env.NODE_ENV = 'test';
import {expect} from 'chai';
import * as mongoose from 'mongoose';
import {MongoMemoryServer} from 'mongodb-memory-server';
import 'mocha';
import {ModelCache} from '../src/index';
import {House, IHouse} from './schemas/house';
import {Car, ICar} from './schemas/car';
import * as sinon from 'sinon';

const car1: ICar = {
	name: 'car1',
};

const car2: ICar = {
	name: 'car2',
};
let mongod: MongoMemoryServer | undefined;

const logger = {
	debug: sinon.fake(),
	info: sinon.fake(),
	trace: sinon.fake(),
	warn: sinon.fake(),
};

const HouseCache = new ModelCache<IHouse & mongoose.Document>('House', logger as any);
const CarCache = new ModelCache<ICar & mongoose.Document>('Car', logger as any);

let carModel: (ICar & mongoose.Document) | undefined;

describe('Mongoose cache', () => {
	before(async function () {
		this.timeout(10000);
		mongod = await MongoMemoryServer.create();
		await mongoose.connect(mongod.getUri());
		await Car.findOneAndDelete({name: car1.name});
		await Car.findOneAndDelete({name: car2.name});
		await House.findOneAndDelete({name: 'house1'});
		// setup
		const car1Model = await new Car(car1).save();
		const car2Model = await new Car(car2).save();
		await new House({name: 'house1', cars: [car1Model._id, car2Model._id]}).save();
	});
	it('should import caches', async () => {
		HouseCache.import(await House.find());
		expect(HouseCache.size()).to.be.eq(1);
		CarCache.import(await Car.find());
		expect(CarCache.size()).to.be.eq(2);
	});
	it('should test sub document populate', async () => {
		const houseModel = HouseCache.list()[0];
		const CarModels = CarCache.getArray(houseModel.cars);
		expect(CarModels.length).to.be.eq(2);
	});
	it('should replace document', async () => {
		logger.debug.resetHistory();
		const carModel = CarCache.list()[0];
		CarCache.replace(carModel);
		expect(logger.debug.calledOnce).to.be.true;
		expect(logger.debug.firstCall.firstArg).to.be.eq(`Car cache update ${carModel._id}`);
	});
	it('should delete document from cache', async () => {
		logger.debug.resetHistory();
		carModel = CarCache.list()[0];
		CarCache.delete(carModel);
		expect(logger.debug.calledOnce).to.be.true;
		expect(logger.debug.firstCall.firstArg).to.be.eq(`Car cache delete ${carModel._id}`);
	});
	it('should add document to cache', async () => {
		if (!carModel) {
			throw new Error('no car model');
		}
		logger.debug.resetHistory();
		CarCache.add(carModel);
		expect(logger.debug.calledOnce).to.be.true;
		expect(logger.debug.firstCall.firstArg).to.be.eq(`Car cache add ${carModel._id}`);
	});
	it('should check document is in cache', async () => {
		if (!carModel) {
			throw new Error('no car model');
		}
		expect(CarCache.haveModel(carModel)).to.be.true;
	});
	it('should get chunk data', async () => {
		const {total, haveMore, index, size} = CarCache.getChunk(1, 0);
		expect({total, haveMore, index, size}).to.be.eql({total: 2, haveMore: true, index: 0, size: 1});
	});
	it('test getting data with binded method', () => {
		const CarList = CarCache.list;
		expect(CarList().length).to.be.eq(2);
	});
});
