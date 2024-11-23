/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {CarModel, type ICar} from './schemas/car';
import {describe, expect, it} from 'vitest';
import {getDocIdStr, getObjectId, isPlainModel, isPlainObjectId} from '../src/objectIdUtils';
import {Types} from 'mongoose';

describe('object id utils', function () {
	it('should verify objectId', function () {
		const carModel = new CarModel<ICar>({name: 'test'});
		expect(isPlainObjectId(carModel._id)).to.equal(true);
		expect(isPlainObjectId(new Types.ObjectId())).to.equal(true);
	});
	it('should verify model', function () {
		const carModel = new CarModel<ICar>({name: 'test'});
		expect(isPlainModel(carModel)).to.equal(true);
		expect(isPlainModel(CarModel.hydrate(carModel.toObject()))).to.equal(true);
	});
	it('should get objectId', function () {
		const carModel = new CarModel<ICar>({name: 'test'});
		expect(getObjectId(carModel)).to.equal(carModel._id);
		expect(getObjectId(carModel._id)).to.equal(carModel._id);
		expect(getObjectId(carModel._id.toString())).to.eql(carModel._id);
		expect(getObjectId(undefined)).to.equal(undefined);
		expect(function () {
			getObjectId({} as any);
		}).to.throw(Error, 'getObjectId: unknown Document ID type: object');
	});
	it('should get document id string', function () {
		const carModel = new CarModel<ICar>({name: 'test'});
		expect(getDocIdStr(carModel)).to.equal(carModel._id.toString());
		expect(getDocIdStr(carModel._id)).to.equal(carModel._id.toString());
		expect(getDocIdStr(carModel._id.toString())).to.eql(carModel._id.toString());
		expect(getDocIdStr(undefined)).to.equal(undefined);
		expect(function () {
			getDocIdStr({} as any);
		}).to.throw(Error, 'getDocIdStr: unknown Document ID type: object');
	});
});
