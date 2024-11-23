import type {Types} from 'mongoose';

export type HydratedDocumentLike<ID extends Types.ObjectId = Types.ObjectId> = {
	_id: ID;
};

export interface AnyCacheChunk {
	chunk: unknown[];
	total: number;
	haveMore: boolean;
	size: number;
	index: number;
}

export interface DocumentCacheChunk<DocType extends HydratedDocumentLike> extends AnyCacheChunk {
	chunk: DocType[];
}

export type CacheFilter<DocType extends HydratedDocumentLike> = (value: DocType, index: number, array: DocType[]) => boolean;
export type CacheSort<DocType extends HydratedDocumentLike> = (a: DocType, b: DocType) => number;

export type ErrorCallbackHandler = (currentId?: Types.ObjectId) => Error;

export type ValidatorHandler<DocType extends HydratedDocumentLike = HydratedDocumentLike> = (document: DocType) => boolean | Error;
