process.env.NODE_ENV = 'test';
import {expect} from 'chai';
import * as timSort from 'timsort';
import * as mongoose from 'mongoose';
import {MongoMemoryServer} from 'mongodb-memory-server';
import 'mocha';
import {ModelCache} from '../src/index';
import {House, IHouse} from './schemas/house';
import {Car, CarDocument, ICar} from './schemas/car';
import * as sinon from 'sinon';
import {carNames, mockCar} from './mock/car';

let mongod: MongoMemoryServer | undefined;

const logger = {
	debug: sinon.fake(),
	info: sinon.fake(),
	trace: sinon.fake(),
	warn: sinon.fake(),
} as any;

const HouseCache = new ModelCache<IHouse & mongoose.Document>('House', {logger});
const CarCache = new ModelCache<ICar & mongoose.Document>('Car', {logger, sorter: timSort.sort});

const onHouseUpdated = sinon.fake();
const onHouseUpdate = sinon.fake();
const onHouseAdd = sinon.fake();
const onHouseDelete = sinon.fake();
HouseCache.on('updated', onHouseUpdated);
HouseCache.on('update', onHouseUpdate);
HouseCache.on('add', onHouseAdd);
HouseCache.on('delete', onHouseDelete);

const onCarUpdated = sinon.fake();
const onCarUpdate = sinon.fake();
const onCarAdd = sinon.fake();
const onCarDelete = sinon.fake();
CarCache.on('updated', onCarUpdated);
CarCache.on('update', onCarUpdate);
CarCache.on('add', onCarAdd);
CarCache.on('delete', onCarDelete);

let carCount = 10000;
let cars: CarDocument[] = [];
let oneCar: CarDocument;

describe('Mongoose cache', () => {
	beforeEach(() => {
		onHouseUpdated.resetHistory();
		onHouseUpdate.resetHistory();
		onHouseAdd.resetHistory();
		onHouseDelete.resetHistory();
		onCarUpdated.resetHistory();
		onCarUpdate.resetHistory();
		onCarAdd.resetHistory();
		onCarDelete.resetHistory();
	});
	before(async function () {
		this.timeout(60000);
		mongod = await MongoMemoryServer.create();
		await mongoose.connect(mongod.getUri());
		await Car.deleteMany({});
		await House.findOneAndDelete({name: 'house1'});
		// setup
		const carPromises: Promise<CarDocument>[] = [];
		for (let i = 0; i < carCount; i++) {
			carPromises.push(new Car(mockCar()).save());
		}
		cars = await Promise.all(carPromises);
		expect(cars.length).to.equal(carCount);
		oneCar = await new Car(mockCar()).save();
		await new House({name: 'house1', cars}).save();
	});
	it('should import caches', async function () {
		this.timeout(60000);
		HouseCache.import(await House.find());
		expect(HouseCache.size()).to.be.eq(1);
		expect(onHouseUpdated.calledOnce).to.be.true;
		CarCache.import(cars);
		expect(CarCache.size()).to.be.eq(carCount);
		expect(onCarUpdated.calledOnce).to.be.true;
	});
	it('should test sub document populate', async () => {
		const houseModel = HouseCache.list()[0];
		const CarModels = CarCache.getArray(houseModel.cars);
		expect(CarModels.length).to.be.eq(carCount);
	});
	it('should add document to cache', async () => {
		logger.debug.resetHistory();
		CarCache.add(oneCar);
		expect(logger.debug.calledOnce).to.be.true;
		expect(logger.debug.firstCall.firstArg).to.be.eq(`Car cache add ${oneCar._id}`);
		carCount++;
		expect(CarCache.size()).to.be.eq(carCount);
	});
	it('should replace document', async () => {
		logger.debug.resetHistory();
		CarCache.replace(oneCar);
		expect(logger.debug.calledOnce).to.be.true;
		expect(logger.debug.firstCall.firstArg).to.be.eq(`Car cache update ${oneCar._id}`);
		expect(onCarUpdated.calledOnce).to.be.true;
		expect(onCarUpdate.calledOnce).to.be.true;
		expect(CarCache.size()).to.be.eq(carCount);
	});
	it('should check document is in cache', async function () {
		this.slow(1);
		expect(CarCache.haveModel(oneCar)).to.be.true;
	});
	it('should delete document from cache', async () => {
		logger.debug.resetHistory();
		CarCache.delete(oneCar);
		expect(logger.debug.calledOnce).to.be.true;
		expect(logger.debug.firstCall.firstArg).to.be.eq(`Car cache delete ${oneCar._id}`);
		expect(onCarUpdated.calledOnce).to.be.true;
		expect(onCarDelete.calledOnce).to.be.true;
		carCount--;
		expect(CarCache.size()).to.be.eq(carCount);
	});
	it('should get chunk data', async () => {
		const {total, haveMore, index, size} = CarCache.getChunk(1, 0);
		expect({total, haveMore, index, size}).to.be.eql({total: carCount, haveMore: true, index: 0, size: 1});
	});
	it('test getting data with binded method', () => {
		const CarList = CarCache.list;
		expect(CarList().length).to.be.eq(carCount);
	});
	it('should mangle filter data', async () => {
		const carList = CarCache.list({preFilter: (c) => c.name === cars[0].name});
		expect(carList.length).to.be.greaterThanOrEqual(1);
	});
	it('should mangle short data asc', async function () {
		this.timeout(10000);
		const carList = CarCache.list({sort: (a, b) => b.name.localeCompare(a.name)});
		expect(carList.length).to.be.eq(carCount);
		expect(carList[0].name.localeCompare(carNames[0])).to.be.greaterThanOrEqual(0);
	});
	it('should mangle short data desc', async function () {
		this.timeout(10000);
		const carList = CarCache.list({sort: (a, b) => a.name.localeCompare(b.name)});
		expect(carList.length).to.be.eq(carCount);
		expect(carList[0].name.localeCompare(carNames[carNames.length - 1])).to.be.lessThanOrEqual(0);
	});
});
