# Mongoose model cache

## This needs only minimal interaction with database if can feed cache with change stream or pre/post hooks or on model creation/delete calls. Can be easily hooked up with cache event's to push data to presentation layers.(i.e. websockets, other services)

### Create cache instance

```typescript
export const SomeCache = new ModelCache<SomeDocument>('Some', {logger: console});
```

### import data

```typescript
SomeCache.import(await SomeModel.find());
```

### Get value(s)

```typescript
const someModel = SomeCache.list().find((s) => s.something === true);

const someModels = SomeCache.list().filter((s) => s.something === true);
```

### Get value(s) with binded method

```typescript
const SomeList = SomeCache.list;

const someModel = SomeList().find((s) => s.something === true);

const someModels = SomeList().filter((s) => s.something === true);
```

### get document with id

```typescript
const subDocument = SubDocCache.get(someModel.subId);
```

### "populate" document id array

```typescript
const subDocuments = SubDocCache.getArray(someModel.subIdList);
```

### Listen cache updates

```typescript
SomeCache.on('updated', () => {
	// do something
});
```

### Iterator to iterate over cache in chunks

```typescript
const carChunkSession: ChunkSession<ICar> = CarCache.getChunkSession(1000, {sort: (a, b) => a.name.localeCompare(b.name)});
const iter: IterableIterator<DocumentCacheSessionChunk<ICar>> = carChunkSession.getIterator();
let current: IteratorResult<DocumentCacheSessionChunk<ICar>> = iter.next();
while (!current.done) {
	const value: DocumentCacheSessionChunk<ICar> = current.value;
	values.total // total number of documents in cache
	values.current // current number of iterated documents
	values.chunk // array of 1000 or less documents in this chunk
}
// you can check if there is more chunks based on current iterated documents and total documents in cache
// or wait for next chunk to be .done === true
```

### Example: Hookup with mongoose change stream

```typescript
changeStream = SomeModel.watch(undefined, {fullDocument: 'updateLookup'});
changeStream.on('change', (change) => {
	if (change.operationType === 'delete') {
		const model = SomeCache.get(change._id);
		if (model) {
			SomeCache.delete(model);
		}
	} else {
		if (change.fullDocument) {
			SomeCache.add(SomeModel.hydrate(change.fullDocument));
		}
	}
});
```

### Example: on Model create/delete

```typescript
const someModel = await new SomeModel({something: true}).save();
SomeCache.add(someModel);
```
