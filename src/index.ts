import {Document} from 'mongoose';
import * as EventEmitter from 'events';
import TypedEmitter from 'typed-emitter';
import {ObjectId} from 'mongodb';
import {LoggerLike} from './loggerLike';

interface MessageEvents<T extends Document> {
	updated: () => void;
	update: (doc: T) => void;
	add: (doc: T) => void;
	delete: (id: ObjectId) => void;
}

export interface AnyCacheChunk {
	chunk: unknown[];
	total: number;
	haveMore: boolean;
	size: number;
	index: number;
}

export interface DocumentCacheChunk<T extends Document> extends AnyCacheChunk {
	chunk: T[];
}

interface MangleOptions<T extends Document> {
	preFilter?: (value: T, index: number, array: T[]) => boolean;
	sort?: (a: T, b: T) => number;
}

export class ModelCache<T extends Document> extends (EventEmitter as {
	new <T extends Document, E = MessageEvents<T>>(): TypedEmitter<E>;
})<T> {
	private name: string;
	private logger: LoggerLike | undefined;

	protected cache: T[] = [];

	public constructor(name: string, logger?: LoggerLike) {
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
	 * Import documents to cache and emit update when done
	 */
	public import(models: T[]): void {
		models.forEach((model) => this.add(model, false));
		this.emit('updated');
	}

	/**
	 * Add single document to cache
	 */
	public add(model: T, doEmit = true): void {
		this.replace(model, doEmit);
	}
	/**
	 * Remove single document from cache
	 */
	public delete(doc: ObjectId | Document | string): boolean {
		const id = getObjectId(doc);
		const idx = this.cache.findIndex((e) => id.equals(e._id));
		if (idx !== -1) {
			this.logger?.debug(`${this.name} cache delete ${id.toHexString()}`);
			this.cache.splice(idx, 1);
			this.emit('updated');
			this.emit('delete', id);
			return true;
		}
		return false;
	}
	/**
	 * Add or replace document in cache
	 */
	public replace(model: T, doEmit = true): void {
		const id = getObjectId(model);
		const idx = this.cache.findIndex((e) => id.equals(e._id));
		if (idx !== -1) {
			this.logger?.debug(`${this.name} cache update ${model._id}`);
			this.cache[idx] = model;
			this.emit('update', model);
		} else {
			this.logger?.debug(`${this.name} cache add ${model._id}`);
			this.cache.push(model);
			this.emit('add', model);
		}
		if (doEmit) {
			this.emit('updated');
		}
	}
	/**
	 * Clear cache and emit update
	 */
	public reset(): void {
		this.cache = [];
		this.emit('updated');
	}
	/**
	 * Get single document from cache
	 */
	public get(id: ObjectId): T | undefined {
		return this.cache.find(({_id}) => id.equals(_id));
	}
	/**
	 * Return existing documents from cache
	 */
	public getArray(idList: ObjectId[] | T[]): T[] {
		const data: T[] = [];
		for (const id of idList) {
			const model = this.get(getObjectId(id));
			if (model) {
				data.push(model);
			}
		}
		return data;
	}
	/**
	 * List documents
	 */
	public list({preFilter, sort}: MangleOptions<T> = {}): T[] {
		// pre-filter
		const filterData = preFilter ? this.cache.filter(preFilter) : [...this.cache];
		// sort
		if (sort) {
			filterData.sort(sort);
		}
		return filterData;
	}
	/**
	 * Return size of cached documents
	 */
	public size(): number {
		return this.cache.length;
	}

	/**
	 * get chunk of data with size and chunk index
	 * @param size chunk size
	 * @param index current index
	 * @returns chunk data, total amount of cache entries and do we have more data than current chunk
	 */
	public getChunk(size: number, index: number, mangle: MangleOptions<T> = {}): DocumentCacheChunk<T> {
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
	public haveModel(model: T): boolean {
		const id = getObjectId(model);
		return this.cache.some((e) => id.equals(e._id));
	}
}

export function getObjectId(data: ObjectId | Document | string): ObjectId {
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
