import {HydratedDocument} from 'mongoose';

export interface AnyCacheSessionChunk {
	chunk: unknown[];
	/**
	 * total amount of data
	 */
	total: number;
	/**
	 * current amount of data iterated
	 */
	current: number;
}

export interface DocumentCacheSessionChunk<T, DocType extends HydratedDocument<T> = HydratedDocument<T>> extends AnyCacheSessionChunk {
	chunk: DocType[];
}

export class ChunkSession<T, DocType extends HydratedDocument<T> = HydratedDocument<T>> {
	private iteratorData: Set<DocumentCacheSessionChunk<T>>;
	constructor(data: DocType[], size: number) {
		const chunks: DocumentCacheSessionChunk<T>[] = [];
		for (let i = 0; i < data.length; i += size) {
			const chunk = data.slice(i, i + size);
			chunks.push({
				chunk,
				total: data.length,
				current: i + chunk.length,
			});
		}
		this.iteratorData = new Set(chunks);
	}

	public getIterator(): IterableIterator<DocumentCacheSessionChunk<T>> {
		return this.iteratorData[Symbol.iterator]();
	}
}
