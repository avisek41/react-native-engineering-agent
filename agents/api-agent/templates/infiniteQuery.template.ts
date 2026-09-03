// external
import { useInfiniteQuery } from '@tanstack/react-query';

// internal
import {
  fetch{{PascalName}},
  type {{PascalName}}Item,
  type {{PascalName}}Response,
} from 'api/{{camelName}}.api';
import { type ApiError } from 'api/apiClient';
import { logger } from 'utils';

const DEFAULT_LIMIT = 20;

export const {{camelName}}Keys = {
  all: ['{{camelName}}'] as const,
  list: (search: string, limit: number) =>
    ['{{camelName}}', 'list', search, limit] as const,
};

type {{PascalName}}SelectedData = {
  items: {{PascalName}}Item[];
  total: number;
};

export type Use{{PascalName}}InfiniteQueryParams = {
  search?: string;
  limit?: number;
  enabled?: boolean;
};

export const use{{PascalName}}InfiniteQuery = ({
  search = '',
  limit = DEFAULT_LIMIT,
  enabled = true,
}: Use{{PascalName}}InfiniteQueryParams = {}) => {
  const trimmedSearch = search.trim();
  const shouldRun = enabled;

  return useInfiniteQuery<
    {{PascalName}}Response,
    ApiError,
    {{PascalName}}SelectedData,
    ReturnType<typeof {{camelName}}Keys.list>,
    number
  >({
    queryKey: {{camelName}}Keys.list(trimmedSearch, limit),
    initialPageParam: 0, // or 1 for page/limit APIs

    queryFn: async ({ pageParam }) => {
      logger.debug('[{{PascalName}}] queryFn', {
        skip: pageParam,
        limit,
        search: trimmedSearch,
      });
      return fetch{{PascalName}}({
        limit,
        skip: pageParam,
        ...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
      });
    },

    getNextPageParam: lastPage => {
      const fetched = (lastPage.skip ?? 0) + (lastPage.data?.length ?? 0);
      return fetched < lastPage.total ? fetched : undefined;
    },

    select: (data): {{PascalName}}SelectedData => ({
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
