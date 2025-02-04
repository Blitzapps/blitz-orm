# SQL syntax

## Nested role

The id fields of the joined table must be queried to identify whether the record exist or not.

```sql
SELECT
  "[table1]__[random]"."[column]" AS "[table1]__[random].[column]",
  "[table2]__[random]"."[column]" AS "[table2]__[random].[column]",
  "[table2]__[random]"."[primary_key_column]" AS "[table2]__[random].[primary_key_column]"
FROM "[table1]" AS "[table1]__[random]"
LEFT JOIN "[table2]" AS "[table2]_[random]"
ON "[table1]_[random]"."[column]" = "[table2]_[random]"."[column]"
WHERE "[table1]__[random]"."[column]" = $1
```

## Nested link field

When querying a nested link field the parent table's id must be queried:

```sql
SELECT
  "[table1]__[random]"."[id_column]" AS "[table1]__[random].[id_column]"
FROM "[table1]" AS "[table1]__[random]";

SELECT
  "[table2]__[random]"."[column]" AS "[table1]__[random]"."[column]"
FROM "[table2]" AS "[table2]__[random]";
WHERE "[table2]__[random]"."[foreign_key_column]" IN $1
```

# Example

## Schema

### Postgres Schema

```sql
CREATE TABLE users (
  id INT PRIMARY KEY,
  name TEXT,
  email TEXT
)

CREATE TABLE projects (
  id INT PRIMARY KEY,
  name TEXT
)

CREATE TABLE posts (
  id INT PRIMARY KEY,
  title TEXT,
  content TEXT,
  project_id INT REFERENCES projects (id)
)

CREATE TABLE post_authors (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users (id),
  post_id INT REFERENCES posts (id)
)
```

### BORM Schema

```ts 
const user = {
  name: 'User',
  defaultDbConnector: { id: 'pg', path: 'users' },
  idFields: ['id'],
  dataFields: [
    { path: 'id', contentType: 'NUMBER' },
    { path: 'name', contentType: 'TEXT' },
    { path: 'email', contentType: 'TEXT' },
  ],
  linkFields: [
    { path: 'postAuthors', relation: 'PostAuthor', plays: 'user' },
    { path: 'posts', relation: 'PostAuthor', plays: 'user', target: 'post' },
  ],
  roles: {},
};

const project = {
  name: 'Project',
  defaultDbConnector: { id: 'pg', path: 'projects' },
  idFields: ['id'],
  dataFields: [
    { path: 'id', contentType: 'NUMBER' },
    { path: 'name', contentType: 'TEXT' },
  ],
  linkFields: [
    { path: 'posts', relation: 'Post', plays: 'project' },
  ],
  roles: {},
};

const post = {
  name: 'Post',
  defaultDbConnector: { id: 'pg', path: 'posts' },
  idFields: ['id'],
  dataFields: [
    { path: 'id', contentType: 'NUMBER' },
    { path: 'title', contentType: 'TEXT' },
    { path: 'content', contentType: 'TEXT' },
    { path: 'projectId', dbPath: 'project_id', contentType: 'NUMBER' },
  ],
  linkFields: [
    { path: 'postAuthors', relation: 'PostAuthor', plays: 'post' },
    { path: 'authors', relation: 'PostAuthor', plays: 'post', target: 'author' },
  ],
  roles: {
    project: { fields: ['projectId'] },
  },
};

const postAuthor = {
  name: 'PostAuthor',
  defaultDbConnector: { id: 'pg', path: 'post_authors' },
  idFields: ['id'],
  dataFields: [
    { path: 'id', contentType: 'NUMBER' },
    // { path: 'userId', dbPath: 'user_id', contentType: 'NUMBER' },
    // { path: 'postId', dbPath: 'post_id', contentType: 'NUMBER' },
  ],
  linkFields: [],
  roles: {
    // user: { dbPath: ['user_id'] },
    // post: { dbPath: ['post_id'] },
    user: { dbConfig: { db: 'pg', fields: [{ path: 'user_id', type: 'INT' }] } },
    post: { dbConfig: { db: 'pg', fields: [{ path: 'post_id', type: 'INT' }] } },
    // user: { fields: ['userId'] },
    // post: { fields: ['postId'] },
  },
};
```

Notes:
- A link field has cardinality MANY if the role it plays is not unique.
- Roles always have cardinality ONE.

What's missing from the existing schema:
- `role.fields` that points to a data field.

What's different from the existing schema:
- `linkField.target` is the name of the opposite role or undefined. If it's undefined, the value is the relation itself. If it's defined, the value is the entity/relation that plays that role.

## Query

### Query all fields

```ts
{
  $thing: 'Post',
  $filter: { projectId: 1 },
}
```

```sql
SELECT
  id,
  title,
  content,
  project_id
FROM posts
WHERE project_id = $1;
```

```ts
type Data = {
  id: number;
  title: string;
  content: string;
  projectId: number;
}[];
```

### Query nested link field relation

```ts
{
  $thing: 'Post',
  $fields: [
    'id',
    'title',
    'content',
    {
      $path: 'postAuthors',
      $fields: [
        { $path: 'user', $fields: ['id', 'name'] },
      ],
    }
  ],
  $filter: { id: 1 },
}
```

```sql
SELECT
  id,
  title,
  content
FROM posts
WHERE id IN ($1);

SELECT
  post_authors__random123.user_id AS "post_authors__random123.user_id",
  users__random456.id AS "users__random456.id",
  users__random456.name AS "users__random456.name"
FROM post_authors AS post_authors__random123
LEFT JOIN users AS users__random456
ON post_authors__random123.user_id = users__random456.id
WHERE post_authors__random123.id IN ($1);
```

```ts
type Data = {
  id: number;
  title: string;
  content: string;
  postAuthors: {
    user: {
      id: number;
      name: string;
    };
  }[];
};
```

```sql
SELECT
FROM a
LEFT JOIN b
ON a.id = b.id
LIMIT = 1
```

### Nested role relation

```ts
{
  $thing: 'Post',
  $fields: [
    'id',
    'title',
    'content',
    {
      $path: 'project',
      $fields: ['id', 'name'],
    }
  ],
  $filter: { id: 1 },
}
```

```sql
SELECT
  "posts__random123"."id" AS "id",
  "posts__random123"."title" AS "title",
  "posts__random123"."content" AS "content",
  "projects__random456"."id" AS "projects__random456.id",
  "projects__random456"."name" AS "projects__random456.name"
FROM "posts" AS "posts__random123"
LEFT JOIN "projects" AS "projects__random456"
ON "posts__random123"."project_id" = "projects__random456.id"
WHERE "posts"."id" = $1
```

```ts
type Data = {
  id: number,
  title: string,
  content: string,
  project: {
    id: number;
    name: string;
  }
};
```

### Nested (tunneled) many-to-many relation

```ts
{
  $thing: 'Post',
  $fields: [
    'id',
    'title',
    'content',
    {
      $path: 'authors',
      $fields: ['id', 'name'],
    }
  ],
}
```

```sql
SELECT
  "posts__123"."id" AS "posts__123.id",
  "posts__123"."title" AS "posts__123.title",
  "posts__123"."content" AS "posts__123.content"
FROM "posts" AS "posts__123"

SELECT
  "users__456"."id",
  "users__456"."name",
FROM "post_authors" AS "post_authors__123"
LEFT JOIN "users" AS "users__456"
ON "post_authors__123"."author_id" = "users__456"."id"
WHERE "post_authors__123"."id" = $1
```

```ts
type Data = {
  id: string;
  title: string;
  content: string;
  authors: {
    id: string;
    name: string;
  }[];
};
```
