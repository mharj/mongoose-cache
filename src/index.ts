import {Document, HydratedDocument} from 'mongoose';
import * as EventEmitter from 'events';
import TypedEmitter from 'typed-emitter';
import {ObjectId} from 'mongodb';
import {LoggerLike} from './loggerLike';

interface MessageEvents<T, DocType extends HydratedDocument<T>> {
	updated: () => void;
	update: (doc: DocType) => void;
	add: (doc: DocType) => void;
	delete: (id: ObjectId) => void;
}

export interface AnyCacheChunk {
	chunk: unknown[];
	total: number;
	haveMore: boolean;
	size: number;
	index: number;
}

export interface DocumentCacheChunk<T, DocType extends HydratedDocument<T>> extends AnyCacheChunk {
	chunk: DocType[];
}

interface MangleOptions<T, DocType extends HydratedDocument<T>> {
	preFilter?: (value: DocType, index: number, array: DocType[]) => boolean;
	sort?: (a: DocType, b: DocType) => number;
}
type ExternalSortFunc<T> = (data: T[], sortFunc: (a: T, b: T) => number) => void;

interface Options<T> {
	logger?: LoggerLike;
	sorter?: ExternalSortFunc<T>;
}

export class ModelCache<T, DocType extends HydratedDocument<T> = HydratedDocument<T>> extends (EventEmitter as {
	new <DocType extends HydratedDocument<any>, E = MessageEvents<any, DocType>>(): TypedEmitter<E>;
})<DocType> {
	private name: string;
	private logger: LoggerLike | undefined;
	private sorter: ExternalSortFunc<DocType> | undefined;

	private cacheRecord: Record<string, DocType> = {};

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
		this.cacheRecord = models.reduce((buildRecord, model) => {
			buildRecord[getDocIdStr<T>(model)] = model;
			return buildRecord;
		}, {});
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
	public delete(doc: ObjectId | DocType | string): boolean {
		const idString = getDocIdStr<T>(doc);
		if (idString in this.cacheRecord) {
			this.logger?.debug(`${this.name} cache delete ${idString}`);
			delete this.cacheRecord[idString];
			this.emit('updated');
			this.emit('delete', getObjectId<T>(doc));
			return true;
		}
		return false;
	}
	/**
	 * Add or replace document in cache
	 */
	public replace(model: DocType): void {
		const idString = getDocIdStr<T>(model);
		if (this.cacheRecord[idString]) {
			this.logger?.debug(`${this.name} cache update ${model._id}`);
			this.cacheRecord[idString] = model;
			this.emit('update', model);
		} else {
			this.logger?.debug(`${this.name} cache add ${model._id}`);
			this.cacheRecord[idString] = model;
			this.emit('add', model);
		}
		this.emit('updated');
	}
	/**
	 * Clear cache and emit update
	 */
	public reset(): void {
		this.cacheRecord = {};
		this.emit('updated');
	}
	/**
	 * Get single document from cache
	 * @param {} id - id of document to get
	 * @param {} onNotFound - optional error throw callback hook if document is not found
	 */
	public get(id: ObjectId, onNotFound: (currentId: ObjectId) => Error): DocType;
	public get(id: ObjectId, onNotFound?: (currentId: ObjectId) => Error): DocType | undefined;
	public get(id: ObjectId, onNotFound?: (currentId: ObjectId) => Error): DocType | undefined {
		const entry = this.cacheRecord[getDocIdStr(id)];
		if (!entry && onNotFound) {
			throw onNotFound(id);
		}
		return entry;
	}
	/**
	 * Return existing documents from cache
	 */
	public getArray(idList: ObjectId[] | DocType[]): DocType[] {
		const data: DocType[] = [];
		for (const id of idList) {
			const model = this.get(getObjectId<T>(id));
			if (model) {
				data.push(model);
			}
		}
		return data;
	}
	/**
	 * List documents
	 */
	public list({preFilter, sort}: MangleOptions<T, DocType> = {}): DocType[] {
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
	public size(): number {
		return Object.keys(this.cacheRecord).length;
	}

	/**
	 * get chunk of data with size and chunk index
	 * @param size chunk size
	 * @param index current index
	 * @returns chunk data, total amount of cache entries and do we have more data than current chunk
	 */
	public getChunk(size: number, index: number, mangle: MangleOptions<T, DocType> = {}): DocumentCacheChunk<T, DocType> {
		const filterData = this.list(mangle);
		// chunks
		const start = size * index;
		const end = start + size;
		return {
			chunk: filterData.slice(start, end),
			total: filterData.length,
			haveMore: end < filterData.length,
			size,
			index,
		};
	}
	/**
	 * is document on cache
	 */
	public haveModel(model: DocType): boolean {
		return getDocIdStr<T>(model) in this.cacheRecord;
	}

	protected asArray(): DocType[] {
		return Object.values(this.cacheRecord);
	}
}

export function getObjectId<T>(data: ObjectId | HydratedDocument<T> | string): ObjectId {
	if (data instanceof Document) {
		if (data._id instanceof ObjectId) {
			return data._id;
		}
		return new ObjectId(data._id);
	}
	if (data instanceof ObjectId) {
		return data;
	}
	return new ObjectId(data);
}

/**
 * get string representation of ObjectId
 */
export function getDocIdStr<T>(data: string | ObjectId | HydratedDocument<T>): string {
	if (typeof data === 'string') {
		return data;
	}
	if (data instanceof ObjectId) {
		return '' + data;
	}
	if (data instanceof Document) {
		return getDocIdStr(data._id);
	}
	throw new Error('unknown Document ID type: ' + typeof data);
}
