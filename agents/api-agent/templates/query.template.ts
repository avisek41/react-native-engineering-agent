// external
import { useQuery } from '@tanstack/react-query';

// internal
import { fetch{{PascalName}}, type {{PascalName}}Response } from 'api/{{camelName}}.api';
import { type ApiError } from 'api/apiClient';
import { logger } from 'utils';

export const {{camelName}}Keys = {
  all: ['{{camelName}}'] as const,
  detail: (id?: string | number) => ['{{camelName}}', 'detail', id] as const,
};

export type Use{{PascalName}}QueryParams = {
  id?: string | number;
  enabled?: boolean;
};

export const use{{PascalName}}Query = ({
  id,
  enabled = true,
}: Use{{PascalName}}QueryParams = {}) => {
  const shouldRun = (id !== undefined ? !!id : true) && enabled;

  return useQuery<{{PascalName}}Response, ApiError>({
    queryKey: {{camelName}}Keys.detail(id),
    queryFn: async () => {
      logger.debug('[{{PascalName}}] queryFn', { id });
      return id !== undefined ? fetch{{PascalName}}({ id }) : fetch{{PascalName}}({});
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
