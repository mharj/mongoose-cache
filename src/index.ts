import {Document, Types} from 'mongoose';
import type {AnyHydratedDocument} from './types';
import {ChunkSession} from './ChunkSession';
import EventEmitter from 'events';
import {ILoggerLike} from '@avanio/logger-like';
import TypedEmitter from 'typed-emitter';
// exports
export * from './ChunkSession';
export * from './types';

type MessageEvents<DocType extends AnyHydratedDocument> = {
	updated: () => void;
	update: (doc: DocType) => void;
	add: (doc: DocType) => void;
	delete: (id: Types.ObjectId) => void;
};

export interface AnyCacheChunk {
	chunk: unknown[];
	total: number;
	haveMore: boolean;
	size: number;
	index: number;
}

export interface DocumentCacheChunk<DocType extends AnyHydratedDocument> extends AnyCacheChunk {
	chunk: DocType[];
}

type CacheFilter<DocType extends AnyHydratedDocument> = (value: DocType, index: number, array: DocType[]) => boolean;

interface MangleOptions<DocType extends AnyHydratedDocument> {
	preFilter?: CacheFilter<DocType>;
	sort?: (a: DocType, b: DocType) => number;
}
type ExternalSortFunc<T> = (data: T[], sortFunc: (a: T, b: T) => number) => void;

interface Options<T> {
	logger?: ILoggerLike;
	sorter?: ExternalSortFunc<T>;
}

export type ErrorCallbackHandler = (currentId?: Types.ObjectId) => Error;

export type ValidatorHandler<DocType extends AnyHydratedDocument = AnyHydratedDocument> = (document: DocType) => boolean | Error;

/**
 * All possible Document ID types we can handle
 */
type CacheIdType<DocType extends AnyHydratedDocument = AnyHydratedDocument> = string | Types.ObjectId | DocType;

export class ModelCache<DocType extends AnyHydratedDocument = AnyHydratedDocument> extends (EventEmitter as {
	new <DocType extends AnyHydratedDocument, E extends MessageEvents<DocType> = MessageEvents<DocType>>(): TypedEmitter<E>;
})<DocType> {
	private name: string;
	private logger: ILoggerLike | undefined;
	private sorter: ExternalSortFunc<DocType> | undefined;

	private cacheMap = new Map<string, DocType>();

	public constructor(name: string, {sorter, logger}: Options<DocType> = {}) {
		super();
		if (!name) {
			throw new Error('no cache name defined');
		}
		this.logger = logger;
		this.sorter = sorter;
		this.name = name;
		this.add = this.add.bind(this);
		this.replace = this.replace.bind(this);
		this.delete = this.delete.bind(this);
		this.list = this.list.bind(this);
	}

	/**
	 * Import documents to cache and emit update when done
	 */
	public import(models: DocType[]): void {
		models.forEach((model) => this.cacheMap.set(getDocIdStr(model, this.logger), model));
		this.emit('updated');
	}

	/**
	 * Add single document to cache
	 */
	public add(model: DocType): void {
		this.replace(model);
	}

	/**
	 * Remove single document from cache
	 */
	public delete(doc: CacheIdType<DocType>): boolean {
		const idString = getDocIdStr(doc, this.logger);
		if (this.cacheMap.has(idString)) {
			this.logger?.debug(`${this.name} cache delete ${idString}`);
			this.cacheMap.delete(idString);
			this.emit('updated');
			this.emit('delete', getObjectId(doc));
			return true;
		}
		return false;
	}

	/**
	 * Add or replace document in cache
	 */
	public replace(model: DocType): void {
		const idString = getDocIdStr(model, this.logger);
		if (this.cacheMap.has(idString)) {
			this.logger?.debug(`${this.name} cache update ${model._id}`);
			this.cacheMap.set(idString, model);
			this.emit('update', model);
		} else {
			this.logger?.debug(`${this.name} cache add ${model._id}`);
			this.cacheMap.set(idString, model);
			this.emit('add', model);
		}
		this.emit('updated');
	}

	/**
	 * Clear cache and emit update
	 */
	public reset(): void {
		this.cacheMap.clear();
		this.emit('updated');
	}

	/**
	 * Get single document from cache
	 * @param {} id - id of document to get
	 * @param {} validator - optional validator function to check if document is valid
	 * @param {} onNotFound - optional error throw callback hook if document is not found
	 */
	public get(id: CacheIdType<DocType>, validator: ValidatorHandler<DocType> | undefined, onNotFound: ErrorCallbackHandler): DocType;
	public get(id: CacheIdType<DocType>, validator?: ValidatorHandler<DocType>, onNotFound?: ErrorCallbackHandler): DocType | undefined;
	public get(id: CacheIdType<DocType>, validator?: ValidatorHandler<DocType>, onNotFound?: ErrorCallbackHandler): DocType | undefined {
		const idString = getDocIdStr(id, this.logger);
		const entry = this.cacheMap.get(idString);
		if (entry && validator) {
			const error = validator(entry);
			if (error === false || error instanceof Error) {
				if (onNotFound) {
					throw error || new Error('Document not found');
				}
				this.logger?.error(error);
				return undefined;
			}
		}
		if (!entry && onNotFound) {
			throw onNotFound(getObjectId(idString));
		}
		return entry;
	}

	/**
	 * Return existing documents from cache
	 */
	public getArray(idList: CacheIdType<DocType>[]): DocType[] {
		return idList.reduce<DocType[]>((acc, id) => {
			const model = this.get(getObjectId(id));
			if (model) {
				acc.push(model);
			}
			return acc;
		}, []);
	}

	/**
	 * List documents
	 */
	public list({preFilter, sort}: MangleOptions<DocType> = {}): DocType[] {
		const data = this.asArray();
		// pre-filter
		const filterData = preFilter ? data.filter(preFilter) : data;
		// sort
		if (sort) {
			if (this.sorter) {
				this.sorter(filterData, sort);
			} else {
				filterData.sort(sort); // use default sort
			}
		}
		return filterData;
	}

	/**
	 * Return size of cached documents
	 */
	public get size(): number {
		return this.cacheMap.size;
	}

	/**
	 * get chunk of data with size and chunk index
	 * @param size chunk size
	 * @param index current index
	 * @returns chunk data, total amount of cache entries and do we have more data than current chunk
	 */
	public getChunk(size: number, index: number, mangle: MangleOptions<DocType> = {}): DocumentCacheChunk<DocType> {
		const filterData = this.list(mangle);
		// chunks
		const start = size * index;
		const end = start + size;
		return {
			chunk: filterData.slice(start, end),
			haveMore: end < filterData.length,
			index,
			size,
			total: filterData.length,
		};
	}

	/**
	 * get chunk session which have iterator to get next chunk
	 */
	public getChunkSession(size: number, mangle: MangleOptions<DocType> = {}) {
		return new ChunkSession<DocType>(this.list(mangle), size);
	}

	/**
	 * is id or document on cache
	 * @deprecated use has() method instead
	 */
	public haveModel(id: CacheIdType<DocType>): boolean {
		return this.cacheMap.has(getDocIdStr(id, this.logger));
	}

	/**
	 * is id or document on cache
	 */
	public has(id: CacheIdType<DocType>): boolean {
		return this.cacheMap.has(getDocIdStr(id, this.logger));
	}

	protected asArray(): DocType[] {
		return Array.from(this.cacheMap.values());
	}

	public values(): IterableIterator<DocType> {
		return this.cacheMap.values();
	}
}

export function getObjectId(data: Types.ObjectId | AnyHydratedDocument | string): Types.ObjectId {
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
export function getDocIdStr(data: string | Types.ObjectId | AnyHydratedDocument, logger: ILoggerLike | undefined): string {
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
			logger ? logger.warn(message) : console.warn(message);
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
