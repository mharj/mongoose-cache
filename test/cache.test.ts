/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable deprecation/deprecation */
/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable import/first */
/* eslint-disable no-unused-expressions */
process.env.NODE_ENV = 'test';
import * as mongoose from 'mongoose';
import * as sinon from 'sinon';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {type CarDocument, CarModel} from './schemas/car';
import {carNames, mockCar} from './mock/car';
import {type ChunkSession, type DocumentCacheSessionChunk} from '../src/ChunkSession';
import {type HouseDocument, HouseModel} from './schemas/house';
import {type ILoggerLike, LogLevel} from '@avanio/logger-like';
import {ModelCache, type ModelCacheLogMap} from '../src/';
import {MongoMemoryServer} from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

const logSpy = sinon.spy();

const logger = {
	debug: logSpy,
	error: logSpy,
	info: logSpy,
	trace: logSpy,
	warn: logSpy,
} satisfies ILoggerLike;

const testLogMapping: ModelCacheLogMap = {
	add: LogLevel.Debug,
	clear: LogLevel.Debug,
	delete: LogLevel.Debug,
	import: LogLevel.Debug,
	update: LogLevel.Debug,
};

const HouseCache = new ModelCache<HouseDocument>('House', {
	logger,
	logMapping: testLogMapping,
});
const CarCache = new ModelCache<CarDocument>('Car', {logger, logMapping: testLogMapping});
CarCache.setLogger(logger);

const onHouseUpdated = sinon.fake();
const onHouseUpdate = sinon.fake();
const onHouseAdd = sinon.fake();
const onHouseDelete = sinon.fake();
HouseCache.on('change', onHouseUpdated);
HouseCache.on('update', onHouseUpdate);
HouseCache.on('add', onHouseAdd);
HouseCache.on('delete', onHouseDelete);

const onCarUpdated = sinon.fake();
const onCarUpdate = sinon.fake();
const onCarAdd = sinon.fake();
const onCarDelete = sinon.fake();
CarCache.on('change', onCarUpdated);
CarCache.on('update', onCarUpdate);
CarCache.on('add', onCarAdd);
CarCache.on('delete', onCarDelete);

let carCount = 10000;
let cars: CarDocument[] = [];
let oneCar: CarDocument;

let carChunkSession: ChunkSession<CarDocument>;

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
		logSpy.resetHistory();
	});
	beforeAll(async function () {
		mongod = await MongoMemoryServer.create();
		await mongoose.connect(mongod.getUri());
		await CarModel.deleteMany({});
		await HouseModel.findOneAndDelete({name: 'house1'});
		// setup
		const carPromises: Promise<CarDocument>[] = [];
		for (let i = 0; i < carCount; i++) {
			carPromises.push(new CarModel(mockCar()).save());
		}
		cars = await Promise.all(carPromises);
		expect(cars.length).to.equal(carCount);
		oneCar = await new CarModel(mockCar()).save();
		await new HouseModel({name: 'house1', cars}).save();
	});
	it('should not exists', function () {
		const rndId = new mongoose.Types.ObjectId();
		expect(CarCache.get(rndId)).to.be.eq(undefined);
		expect(() => CarCache.get(rndId, () => new Error('test'))).to.throw(Error, 'test');
	});

	it('should import caches', {timeout: 60000}, async function () {
		HouseCache.import(await HouseModel.find());
		expect(HouseCache.size).to.be.eq(1);
		expect(onHouseUpdated.calledOnce).to.be.eq(true);
		CarCache.import(cars);
		expect(CarCache.size).to.be.eq(carCount);
		expect(onCarUpdated.calledOnce).to.be.eq(true);
	});
	it('should test sub document populate', function () {
		const houseModel = HouseCache.list()[0];
		if (!houseModel) {
			throw new Error('no house model');
		}
		const CarModels = CarCache.getArray(houseModel.cars);
		expect(CarModels.length).to.be.eq(carCount);
	});
	it('should add document to cache', function () {
		CarCache.add(oneCar);
		expect(logSpy.calledOnce).to.be.eq(true);
		expect(logSpy.firstCall.firstArg).to.be.eq(`Car cache add ${oneCar._id.toString()}`);
		carCount++;
		expect(CarCache.size).to.be.eq(carCount);
	});
	it('should get document to cache', function () {
		const carModel = CarCache.get(oneCar._id, () => new Error('not found'));
		expect(carModel).to.be.not.eq(undefined);
		expect(carModel.name).to.be.eq(oneCar.name);
	});
	it('should function get document to cache', function () {
		const carModel = CarCache.get(oneCar._id, () => new Error('not found'));
		expect(carModel).to.be.not.eq(undefined);
		expect(carModel.name).to.be.eq(oneCar.name);
	});
	it('should replace document', function () {
		CarCache.replace(oneCar);
		expect(logSpy.calledOnce).to.be.eq(true);
		expect(logSpy.firstCall.firstArg).to.be.eq(`Car cache update ${oneCar._id.toString()}`);
		expect(onCarUpdated.calledOnce).to.be.eq(true);
		expect(onCarUpdate.calledOnce).to.be.eq(true);
		expect(CarCache.size).to.be.eq(carCount);
	});
	it('should check document is in cache', function () {
		expect(CarCache.has(oneCar)).to.be.eq(true);
		expect(CarCache.haveModel(oneCar)).to.be.eq(true);
	});
	it('should delete document from cache', function () {
		expect(CarCache.delete(oneCar)).to.be.eq(true);
		expect(CarCache.delete(oneCar)).to.be.eq(false);
		expect(logSpy.calledOnce).to.be.eq(true);
		expect(logSpy.firstCall.firstArg).to.be.eq(`Car cache delete ${oneCar._id.toString()}`);
		expect(onCarUpdated.calledOnce).to.be.eq(true);
		expect(onCarDelete.calledOnce).to.be.eq(true);
		carCount--;
		expect(CarCache.size).to.be.eq(carCount);
	});
	it('should get chunk data', function () {
		const {total, haveMore, index, size} = CarCache.getChunk(1, 0);
		expect({haveMore, index, size, total}).to.be.eql({haveMore: true, index: 0, size: 1, total: carCount});
	});
	it('test getting data with bind method', () => {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const CarList = CarCache.list;
		expect(CarList().length).to.be.eq(carCount);
	});
	it('should mangle filter data', function () {
		const firstCar = cars[0];
		if (!firstCar) {
			throw new Error('no first car');
		}
		const carList = CarCache.list({preFilter: (c) => c.name === firstCar.name});
		expect(carList.length).to.be.greaterThanOrEqual(1);
	});
	it('should mangle short data asc', {timeout: 10000}, function () {
		const carList = CarCache.list({sort: (a, b) => b.name.localeCompare(a.name)});
		expect(carList.length).to.be.eq(carCount);
		const firstCar = cars[0];
		if (!firstCar) {
			throw new Error('no first car');
		}
		expect(firstCar.name.localeCompare(carNames[0])).to.be.greaterThanOrEqual(0);
	});
	it('should mangle short data desc', {timeout: 10000}, function () {
		const carList = CarCache.list({sort: (a, b) => a.name.localeCompare(b.name)});
		expect(carList.length).to.be.eq(carCount);
		const firstCar = cars[0];
		if (!firstCar) {
			throw new Error('no first car');
		}
		const lastCarName = carNames[carNames.length - 1];
		if (!lastCarName) {
			throw new Error('no last car name');
		}
		expect(firstCar.name.localeCompare(lastCarName)).to.be.lessThanOrEqual(0);
	});
	it('should reset cache (deprecated)', function () {
		expect(CarCache.size).not.to.be.eq(0);
		CarCache.reset();
		expect(CarCache.size).to.be.eq(0);
	});
	it('should clear cache', function () {
		CarCache.import(cars);
		expect(CarCache.size).not.to.be.eq(0);
		CarCache.clear();
		expect(CarCache.size).to.be.eq(0);
	});
	describe('ChunkSession', () => {
		beforeAll(() => {
			CarCache.clear();
			CarCache.import(cars);
		});
		it('should create chunk session', {timeout: 100}, function () {
			carChunkSession = CarCache.getChunkSession(1000, {sort: (a, b) => a.name.localeCompare(b.name)});
		});
		it('should test Chunk iterator session', () => {
			const iter: IterableIterator<DocumentCacheSessionChunk<CarDocument>> = carChunkSession.getIterator();
			let current: IteratorResult<DocumentCacheSessionChunk<CarDocument>> = iter.next();
			while (!current.done) {
				const value: DocumentCacheSessionChunk<CarDocument> = current.value;
				expect(value.total).to.be.eq(carCount);
				expect(value.chunk.length).to.be.eq(1000);
				current = iter.next();
			}
			expect(current.done).to.be.eq(true);
		});
	});
});
