import type {HydratedDocumentLike} from './types';

export interface DocumentCacheSessionChunk<DocType extends HydratedDocumentLike = HydratedDocumentLike> {
	chunk: DocType[];
	/**
	 * total amount of data
	 */
	total: number;
	/**
	 * current amount of data iterated
	 */
	current: number;
}

export class ChunkSession<DocType extends HydratedDocumentLike = HydratedDocumentLike> {
	private readonly iteratorData: Set<DocumentCacheSessionChunk<DocType>>;
	constructor(data: DocType[], size: number) {
		const chunks: DocumentCacheSessionChunk<DocType>[] = [];
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

	public getIterator(): IterableIterator<DocumentCacheSessionChunk<DocType>> {
		return this.iteratorData[Symbol.iterator]();
	}
}
