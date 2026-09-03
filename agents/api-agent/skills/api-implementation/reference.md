# API Implementation Reference & Blueprints

Copy these shapes. Replace `{camelName}` / `{PascalName}` / `{CONST}` from the endpoint path. Match Swagger paging (`page` vs `skip`).

---

## 1. Types — `src/types/{camelName}.types.ts`

Zero imports. Never `any`. Optional fields use `?`.

```ts
export type ProductsSearchItem = {
  id: number;
  title: string;
  price: number;
  thumbnail?: string;
};

export type ProductsSearchParams = {
  limit: number;
  skip: number; // or page: number when Swagger uses page
  search?: string;
};

export type ProductsSearchResponse = {
  data: ProductsSearchItem[];
  total: number;
  skip: number;
  limit: number;
};
```

POST | PUT | PATCH only:

```ts
export type AuthLoginPayload = {
  email: string;
  password: string;
};
```

Unknown response:

```ts
export type OrderDeleteResponse = {
  // TODO: fill from API contract
  [key: string]: unknown;
};
```

---

## 2. Endpoint Constant — `src/api/endPoints.ts`

```ts
PRODUCTS_SEARCH: 'products/search',
```

SCREAMING_SNAKE_CASE. Strip leading slash. If the constant already exists, use it as-is.

---

## 3. API File — `src/api/{camelName}.api.ts`

```ts
// external
import { apiRequest } from 'api/apiClient';
import { ENDPOINTS } from 'api/endPoints';
import { logger } from 'utils';

// types — barrel only
import type {
  ProductsSearchItem,
  ProductsSearchParams,
  ProductsSearchResponse,
} from 'types';

export type {
  ProductsSearchItem,
  ProductsSearchParams,
  ProductsSearchResponse,
} from 'types';

export const fetchProductsSearch = async (
  params: ProductsSearchParams,
): Promise<ProductsSearchResponse> => {
  logger.debug('[ProductsSearch] fetch', params);

  return apiRequest<ProductsSearchResponse>({
    endpoint: ENDPOINTS.PRODUCTS_SEARCH,
    method: 'GET',
    params: {
      limit: params.limit,
      skip: params.skip,
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    },
    skipAuth: false,
  });
};
```

Path parameter endpoint: `` endpoint: `${ENDPOINTS.CONST}/${id}` ``.

POST: `body: payload`. PUT/PATCH: method + body. DELETE: no body.

When Swagger uses `page` (1-based), send `page` / `limit` — see `fetchProgramProgramTeamsList`.

---

## 4. Infinite Query — `src/hooks/queries/use{PascalName}InfiniteQuery.ts`

```ts
// external
import { useInfiniteQuery } from '@tanstack/react-query';

// internal
import {
  fetchProductsSearch,
  type ProductsSearchItem,
  type ProductsSearchResponse,
} from 'api/productsSearch.api';
import { type ApiError } from 'api/apiClient';
import { logger } from 'utils';

const DEFAULT_LIMIT = 20;

export const productsSearchKeys = {
  all: ['productsSearch'] as const,
  list: (search: string, limit: number) =>
    ['productsSearch', 'list', search, limit] as const,
};

type ProductsSearchSelectedData = {
  items: ProductsSearchItem[];
  total: number;
};

export type UseProductsSearchInfiniteQueryParams = {
  search?: string;
  limit?: number;
  enabled?: boolean;
};

export const useProductsSearchInfiniteQuery = ({
  search = '',
  limit = DEFAULT_LIMIT,
  enabled = true,
}: UseProductsSearchInfiniteQueryParams = {}) => {
  const trimmedSearch = search.trim();
  const shouldRun = enabled;

  return useInfiniteQuery<
    ProductsSearchResponse,
    ApiError,
    ProductsSearchSelectedData,
    ReturnType<typeof productsSearchKeys.list>,
    number
  >({
    queryKey: productsSearchKeys.list(trimmedSearch, limit),
    initialPageParam: 0, // use 1 when paging is page/limit

    queryFn: async ({ pageParam }) => {
      logger.debug('[ProductsSearch] queryFn', {
        skip: pageParam,
        limit,
        search: trimmedSearch,
      });
      return fetchProductsSearch({
        limit,
        skip: pageParam,
        ...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
      });
    },

    getNextPageParam: lastPage => {
      const fetched = lastPage.skip + lastPage.data.length;
      return fetched < lastPage.total ? fetched : undefined;
    },

    select: (data): ProductsSearchSelectedData => ({
      items: data.pages.flatMap(p => p.data ?? []),
      total: data.pages[0]?.total ?? 0,
    }),

    enabled: shouldRun,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    placeholderData: prev => prev,
    maxPages: 10,
    retry: (failureCount, err) => {
      if (err.status >= 400 && err.status < 500) return false;
      return failureCount < 2;
    },
  });
};
```

**`page`/`limit` variant:** `initialPageParam: 1`; `queryFn` sends `page: pageParam`; `getNextPageParam` uses `hasNextPage` or `lastPageParam + 1`.

Always `select` to `{ items, total }`. Never `enabled: true` on empty search if the API forbids empty search.

---

## 5. Single Query — `src/hooks/queries/use{PascalName}Query.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchUserMe, type UserMeResponse } from 'api/userMe.api';
import { type ApiError } from 'api/apiClient';
import { logger } from 'utils';

export const userMeKeys = {
  all: ['userMe'] as const,
  detail: (id?: string | number) => ['userMe', 'detail', id] as const,
};

export type UseUserMeQueryParams = {
  id?: string | number;
  enabled?: boolean;
};

export const useUserMeQuery = ({
  id,
  enabled = true,
}: UseUserMeQueryParams = {}) => {
  const shouldRun = (id !== undefined ? !!id : true) && enabled;

  return useQuery<UserMeResponse, ApiError>({
    queryKey: userMeKeys.detail(id),
    queryFn: async () => {
      logger.debug('[UserMe] queryFn', { id });
      return id !== undefined ? fetchUserMe(id) : fetchUserMe();
    },
    enabled: shouldRun,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: (failureCount, err) => {
      if (err.status >= 400 && err.status < 500) return false;
      return failureCount < 2;
    },
  });
};
```

---

## 6. Mutation — `src/hooks/mutation/use{PascalName}Mutation.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAuthLogin,
  type AuthLoginPayload,
  type AuthLoginResponse,
} from 'api/authLogin.api';
import { type ApiError } from 'api/apiClient';
import { API_TOAST } from 'utils/queryToastMeta';
import { logger } from 'utils';

export const authLoginKeys = {
  all: ['authLogin'] as const,
};

type UseAuthLoginMutationVariables = AuthLoginPayload;

export const useAuthLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<AuthLoginResponse, ApiError, UseAuthLoginMutationVariables>(
    {
      mutationFn: variables => {
        logger.debug('[AuthLogin] mutationFn', variables);
        return fetchAuthLogin(variables);
      },
      meta: API_TOAST, // omit if this mutation must stay silent
      onSuccess: (_data, variables) => {
        void queryClient.invalidateQueries({ queryKey: authLoginKeys.all });
        logger.info('[AuthLogin] Mutation succeeded', variables);
      },
      onError: (err, variables) => {
        logger.error('[AuthLogin] Mutation failed', {
          status: err.status,
          data: err.data,
          variables,
        });
      },
    },
  );
};
```

---

## 7. Barrels

`src/types/index.ts` — append, never duplicate:

```ts
export type {
  ProductsSearchItem,
  ProductsSearchParams,
  ProductsSearchResponse,
} from './productsSearch.types';
```

`src/hooks/index.ts`:

```ts
export {
  useProductsSearchInfiniteQuery,
  productsSearchKeys,
} from './queries/useProductsSearchInfiniteQuery';

export { useAuthLoginMutation } from './mutation/useAuthLoginMutation';
```

---

## 8. NEVER Checklist

| Rule | Why |
| --- | --- |
| Types inside api or hook files | types file only |
| Body on GET or DELETE | HTTP spec |
| `useInfiniteQuery` without `select` | consumers must not flatten pages |
| Retry 4xx | will not recover |
| `any` / bare `unknown` without TODO | type safety |
| Payload type on GET or DELETE | wrong |
| Invented response fields | contract only |
| `ApiError` from anywhere but `api/apiClient` | single source |
| Skip barrel `index.ts` updates | broken imports |
| Guess `ENDPOINTS` name | read `endPoints.ts` first |
| `hooks/mutations/` | real folder is `hooks/mutation/` |
| `STRINGS.COMMON.METHODS.*` in api files | UI layer |
| `retry: false` | blocks 5xx recovery |
| Static `detail` key | must be `detail: (id?) => [...]` |
| Omit `staleTime` / `gcTime` | refetch / flash bugs |
| Relative type imports in api files | `from 'types'` only |
| Positional hook args | `({ enabled = true } = {})` |
| Screen / PTR / LegendList code | Integration skill |
