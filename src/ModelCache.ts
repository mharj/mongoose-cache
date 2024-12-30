import {
	type CacheFilter,
	type CacheSort,
	ChunkSession,
	type DocumentCacheChunk,
	type ErrorCallbackHandler,
	getDocIdStr,
	getObjectId,
	type ObjectIdTypes,
} from './';
import type {HydratedDocument, Types} from 'mongoose';
import {type ILoggerLike, LogLevel, type LogMapping, MapLogger} from '@avanio/logger-like';
import {EventEmitter} from 'events';

const defaultLogMap = {
	add: LogLevel.None,
	clear: LogLevel.None,
	delete: LogLevel.None,
	import: LogLevel.None,
	update: LogLevel.None,
};

export type ModelCacheLogMap = LogMapping<keyof typeof defaultLogMap>;

export type ModelCacheEventsMap<DocType extends HydratedDocument<unknown>> = {
	change: [];
	update: [doc: DocType];
	add: [doc: DocType];
	delete: [doc: DocType];
	init: [entries: [Types.ObjectId, DocType][]];
};

interface MangleOptions<DocType extends HydratedDocument<unknown>> {
	preFilter?: CacheFilter<DocType>;
	sort?: CacheSort<DocType>;
}

export interface ModelCacheOptions {
	logger?: ILoggerLike;
	logMapping?: Partial<ModelCacheLogMap>;
}

export class ModelCache<DocType extends HydratedDocument<unknown> = HydratedDocument<unknown>> extends EventEmitter<ModelCacheEventsMap<DocType>> {
	private readonly name: string;
	private readonly logger: MapLogger<ModelCacheLogMap>;

	private readonly cacheMap = new Map<string, DocType>();

	public constructor(name: string, {logger, logMapping}: ModelCacheOptions = {}) {
		super();
		if (!name) {
			throw new Error('no cache name defined');
		}
		this.logger = new MapLogger(logger, defaultLogMap);
		if (logMapping) {
			this.setLogMapping(logMapping);
		}
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
		this.logger.setLogger(logger);
	}

	public setLogMapping(logMap: Partial<ModelCacheLogMap>): void {
		this.logger.setLogMapping(logMap);
	}

	/**
	 * Import documents to cache and emit update when done
	 */
	public import(models: Iterable<DocType>): void {
		const modelArray = Array.from(models);
		modelArray.forEach((model) => this.cacheMap.set(getDocIdStr(model, this.logger), model));
		this.emit(
			'init',
			modelArray.map((model) => [model._id, model]),
		);
		this.emit('change');
		this.logger.logKey('import', `${this.name} cache import ${modelArray.length.toString()} documents`);
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
			this.cacheMap.delete(idString);
			if (notify) {
				this.emit('change');
				this.emit('delete', entry);
			}
			this.logger.logKey('delete', `${this.name} cache delete ${idString}`);
			return true;
		}
		return false;
	}

	/**
	 * Add or replace document in cache
	 */
	public replace(model: DocType, notify = true): void {
		const idString = getDocIdStr(model, this.logger);
		const isUpdate = this.cacheMap.has(idString);
		this.cacheMap.set(idString, model);
		if (notify) {
			this.emit(isUpdate ? 'update' : 'add', model);
			this.emit('change');
		}
		this.logger.logKey(isUpdate ? 'update' : 'add', `${this.name} cache ${isUpdate ? 'update' : 'add'} ${idString}`);
	}

	/**
	 * Clear cache and emit update
	 * @deprecated use clear() method instead
	 */
	public reset(): void {
		this.clear();
	}

	/**
	 * Clear cache and emit update
	 */
	public clear(): void {
		this.cacheMap.clear();
		this.notify();
		this.logger.logKey('clear', `${this.name} cache clear`);
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
	 * @param {ErrorCallbackHandler} buildErrorCallback - optional error throw callback hook if document is not found
	 */
	public get(id: ObjectIdTypes<DocType>, buildErrorCallback: ErrorCallbackHandler): DocType;
	public get(id: ObjectIdTypes<DocType>, buildErrorCallback?: ErrorCallbackHandler): DocType | undefined;
	public get(id: ObjectIdTypes<DocType>, buildErrorCallback?: ErrorCallbackHandler): DocType | undefined {
		const idString = getDocIdStr(id, this.logger);
		const entry = this.cacheMap.get(idString);
		if (!entry && buildErrorCallback) {
			throw buildErrorCallback(getObjectId(idString));
		}
		return entry;
	}

	/**
	 * Return existing documents from cache
	 * @param {Iterable<ObjectIdTypes<DocType>>} idList - list of document ids to get
	 * @returns {DocType[]} list of cached documents
	 * @example
	 * const subDocs = subDocCache.getArray(mainModel.subDocIds);
	 */
	public getArray(idList: Iterable<ObjectIdTypes<DocType>>): DocType[] {
		return Array.from(idList).reduce<DocType[]>((acc, id) => {
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
	public list({preFilter, sort}: MangleOptions<DocType> = {}): DocType[] {
		const data = this.asArray();
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
