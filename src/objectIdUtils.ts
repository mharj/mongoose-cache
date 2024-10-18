import {Document, type HydratedDocument, Types} from 'mongoose';
import type {ILoggerLike} from '@avanio/logger-like';

/**
 * All possible Document ID types we can handle
 */
export type ObjectIdTypes<DocType extends HydratedDocument<unknown> = HydratedDocument<unknown>> = Types.ObjectId | DocType | string;

export function getObjectId(data: ObjectIdTypes): Types.ObjectId;
export function getObjectId(data: ObjectIdTypes | undefined): Types.ObjectId | undefined;
export function getObjectId(data: ObjectIdTypes | undefined): Types.ObjectId | undefined {
	if (!data) {
		return undefined;
	}
	if (typeof data === 'string') {
		return new Types.ObjectId(data);
	}
	if (data instanceof Types.ObjectId) {
		return data;
	}
	if (data instanceof Document && data._id instanceof Types.ObjectId) {
		return data._id;
	}
	throw new Error('getObjectId: unknown Document ID type: ' + typeof data);
}

/**
 * get string representation of ObjectId
 */
let warnOnce = false;
export function getDocIdStr(data: ObjectIdTypes, logger: ILoggerLike | undefined): string;
export function getDocIdStr(data: ObjectIdTypes | undefined, logger: ILoggerLike | undefined): string | undefined;
export function getDocIdStr(data: ObjectIdTypes | undefined, logger: ILoggerLike | undefined): string | undefined {
	if (!data) {
		return undefined;
	}
	if (typeof data === 'string') {
		return data;
	}
	if (data instanceof Types.ObjectId) {
		return data.toString();
	}
	if (data instanceof Document && data._id instanceof Types.ObjectId) {
		return getDocIdStr(data._id, logger);
	}
	// object document and objectid fallback (strange issue with new mongoose version)
	if (isPlainModel(data) && isPlainObjectId(data._id)) {
		if (!warnOnce) {
			const message = 'getDocIdStr: objects are not instance of Document (mongoose bug?), fallback to check constructor names';
			if (logger) {
				logger.warn(message);
			} else {
				console.warn(message);
			}
			warnOnce = true;
		}
		return data._id.toString();
	}
	throw new Error('getDocIdStr: unknown Document ID type: ' + typeof data);
}

function isPlainObjectId(data: unknown): data is Types.ObjectId {
	return typeof data === 'object' && data !== null && data.constructor.name === 'ObjectId';
}

function isPlainModel(data: unknown): data is Document {
	return typeof data === 'object' && data !== null && data.constructor.name === 'model';
}
