import {
	type AnyHydratedDocument,
	type CacheFilter,
	type CacheSort,
	ChunkSession,
	type DocumentCacheChunk,
	type ErrorCallbackHandler,
	getDocIdStr,
	getObjectId,
	type ObjectIdTypes,
	type ValidatorHandler,
} from './';
import EventEmitter from 'events';
import type {ILoggerLike} from '@avanio/logger-like';
import type TypedEmitter from 'typed-emitter';
import type {Types} from 'mongoose';

type MessageEvents<DocType extends AnyHydratedDocument> = {
	change: () => void;
	update: (doc: DocType) => void;
	add: (doc: DocType) => void;
	delete: (doc: DocType) => void;
	init: (entries: [Types.ObjectId, DocType][]) => void;
};

interface MangleOptions<DocType extends AnyHydratedDocument> {
	preFilter?: CacheFilter<DocType>;
	sort?: CacheSort<DocType>;
}

export interface ModelCacheOptions {
	logger?: ILoggerLike;
}

type ModelCacheEventEmitter = {new <DocType extends AnyHydratedDocument, E extends MessageEvents<DocType> = MessageEvents<DocType>>(): TypedEmitter<E>};

export class ModelCache<DocType extends AnyHydratedDocument = AnyHydratedDocument> extends (EventEmitter as ModelCacheEventEmitter)<DocType> {
	private readonly name: string;
	private logger: ILoggerLike | undefined;

	private readonly cacheMap = new Map<string, DocType>();

	public constructor(name: string, {logger}: ModelCacheOptions = {}) {
		super();
		if (!name) {
			throw new Error('no cache name defined');
		}
		this.logger = logger;
		this.name = name;
		this.add = this.add.bind(this);
		this.replace = this.replace.bind(this);
		this.delete = this.delete.bind(this);
		this.list = this.list.bind(this);
	}

	/**
	 * Set logger for cache
	 * @param logger - logger instance
	 */
	public setLogger(logger: ILoggerLike | undefined): void {
		this.logger = logger;
	}

	/**
	 * Import documents to cache and emit update when done
	 */
	public import(models: DocType[]): void {
		models.forEach((model) => this.cacheMap.set(getDocIdStr(model, this.logger), model));
		this.emit(
			'init',
			models.map((model) => [model._id, model]),
		);
		this.emit('change');
	}

	/**
	 * Add single document to cache
	 */
	public add(model: DocType, notify = true): void {
		this.replace(model, notify);
	}

	/**
	 * Remove single document from cache
	 */
	public delete(doc: ObjectIdTypes<DocType>, notify = true): boolean {
		const idString = getDocIdStr(doc, this.logger);
		const entry = this.cacheMap.get(idString);
		if (entry) {
			this.logger?.debug(`${this.name} cache delete ${idString}`);
			this.cacheMap.delete(idString);
			if (notify) {
				this.emit('change');
				this.emit('delete', entry);
			}
			return true;
		}
		return false;
	}

	/**
	 * Add or replace document in cache
	 */
	public replace(model: DocType, notify = true): void {
		const idString = getDocIdStr(model, this.logger);
		if (this.cacheMap.has(idString)) {
			this.logger?.debug(`${this.name} cache update ${model._id.toString()}`);
			this.cacheMap.set(idString, model);
			if (notify) {
				this.emit('update', model);
			}
		} else {
			this.logger?.debug(`${this.name} cache add ${model._id.toString()}`);
			this.cacheMap.set(idString, model);
			if (notify) {
				this.emit('add', model);
			}
		}
		if (notify) {
			this.emit('change');
		}
	}

	/**
	 * Clear cache and emit update
	 * @deprecated use clear() method instead
	 */
	public reset(): void {
		this.cacheMap.clear();
		this.notify();
	}

	/**
	 * Clear cache and emit update
	 */
	public clear(): void {
		this.cacheMap.clear();
		this.notify();
	}

	public notify(): void {
		this.emit(
			'init',
			this.asArray().map((model) => [model._id, model]),
		);
		this.emit('change');
	}

	/**
	 * Get single document from cache
	 * @param {ObjectIdTypes<DocType>} id - id of document to get
	 * @param {ValidatorHandler<DocType>} validator - optional validator function to check if document is valid
	 * @param {ErrorCallbackHandler} onNotFound - optional error throw callback hook if document is not found
	 */
	public get(id: ObjectIdTypes<DocType>, validator: ValidatorHandler<DocType> | undefined, onNotFound: ErrorCallbackHandler): DocType;
	public get(id: ObjectIdTypes<DocType>, validator?: ValidatorHandler<DocType>, onNotFound?: ErrorCallbackHandler): DocType | undefined;
	public get(id: ObjectIdTypes<DocType>, validator?: ValidatorHandler<DocType>, onNotFound?: ErrorCallbackHandler): DocType | undefined {
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
	 * @param {ObjectIdTypes<DocType>[]} idList - list of document ids to get
	 * @returns {DocType[]} list of cached documents
	 * @example
	 * const subDocs = subDocCache.getArray(mainModel.subDocIds);
	 */
	public getArray(idList: ObjectIdTypes<DocType>[]): DocType[] {
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
	 * @param {MangleOptions<DocType>} options - optional preFilter and sort options
	 * @param options.preFilter - optional pre-filter function to filter documents
	 * @param options.sort - optional sort function to sort documents (done after pre-filtering)
	 * @returns {DocType[]} list of cached documents
	 * @example
	 * const filterActive: CacheFilter<ModelType> = (doc) => doc.active;
	 * const sortByModify: CacheSort<ModelType> = (a, b) => a.modified - b.modified;
	 * const list = cache.list({preFilter: filterActive, sort: sortByModify});
	 */
	public list<Out extends DocType>({preFilter, sort}: MangleOptions<Out> = {}): Out[] {
		const data = this.asArray() as Out[];
		// pre-filter
		const filterData = preFilter ? data.filter(preFilter) : data;
		// sort
		if (sort) {
			filterData.sort(sort);
		}
		return filterData;
	}

	/**
	 * Size of document cache
	 * @returns {number} - number of documents in cache
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
	public getChunkSession(size: number, mangle: MangleOptions<DocType> = {}): ChunkSession<DocType> {
		return new ChunkSession<DocType>(this.list(mangle), size);
	}

	/**
	 * is id or document on cache
	 * @deprecated use has() method instead
	 */
	public haveModel(id: ObjectIdTypes<DocType>): boolean {
		return this.cacheMap.has(getDocIdStr(id, this.logger));
	}

	/**
	 * is id or document on cache
	 */
	public has(id: ObjectIdTypes<DocType>): boolean {
		return this.cacheMap.has(getDocIdStr(id, this.logger));
	}

	protected asArray(): DocType[] {
		return Array.from(this.cacheMap.values());
	}

	public values(): IterableIterator<DocType> {
		return this.cacheMap.values();
	}
}
