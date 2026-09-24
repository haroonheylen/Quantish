export type Unit = 'm' | 'm2' | 'm3' | 'kg' | 'piece';
export type ObjectType = 'wall' | 'door' | 'window' | 'slab';

export interface Article {
  id: string;
  parentId: string | null;
  code: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// Money and quantities arrive as strings from the API, to keep exact decimals.
export interface ArticleNode extends Article {
  total: string;
  children: ArticleNode[];
}

// Named BillObject because "Object" would shadow JavaScript's built-in.
export interface BillObject {
  id: string;
  articleId: string | null;
  name: string;
  type: ObjectType;
  unit: Unit;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  properties: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleDetail extends Article {
  total: string;
  children: (Article & { total: string })[];
  objects: BillObject[];
}

export interface Summary {
  currency: 'EUR';
  articles: { id: string; code: string; title: string; subtotal: string }[];
  grandTotal: string;
}

export interface CreateArticleInput {
  code: string;
  title: string;
  description?: string;
  parentId?: string | null;
}