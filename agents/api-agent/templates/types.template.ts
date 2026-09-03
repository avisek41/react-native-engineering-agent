// Pure Types Template - Zero Imports Allowed

export type {{PascalName}}Item = {
  id: number | string;
  // TODO: Add schema fields
};

export type {{PascalName}}Params = {
  limit?: number;
  skip?: number; // or page?: number
  search?: string;
};

export type {{PascalName}}Payload = {
  // TODO: Add payload fields for POST/PUT/PATCH
};

export type {{PascalName}}Response = {
  data: {{PascalName}}Item[];
  total: number;
  skip?: number;
  limit?: number;
};
