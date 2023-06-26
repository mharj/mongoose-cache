import {HydratedDocument} from 'mongoose';

export interface AnyCacheSessionChunk {
	chunk: unknown[];
	total: number;
}

export interface DocumentCacheSessionChunk<T, DocType extends HydratedDocument<T>> extends AnyCacheSessionChunk {
	chunk: DocType[];
}

export class ChunkSession<T, DocType extends HydratedDocument<T> = HydratedDocument<T>> {
	private iteratorData: Set<DocumentCacheSessionChunk<T, DocType>>;
	constructor(data: DocType[], size: number) {
		const chunks: DocumentCacheSessionChunk<T, DocType>[] = [];
		for (let i = 0; i < data.length; i += size) {
			chunks.push({
				chunk: data.slice(i, i + size),
				total: data.length,
			});
		}
		this.iteratorData = new Set(chunks);
	}

	public getIterator(): IterableIterator<DocumentCacheSessionChunk<T, DocType>> {
		return this.iteratorData[Symbol.iterator]();
	}
}
