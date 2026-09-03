// external
import { useMutation, useQueryClient } from '@tanstack/react-query';

// internal
import {
  fetch{{PascalName}},
  type {{PascalName}}Payload,
  type {{PascalName}}Response,
} from 'api/{{camelName}}.api';
import { type ApiError } from 'api/apiClient';
import { API_TOAST } from 'utils/queryToastMeta';
import { logger } from 'utils';

export const {{camelName}}Keys = {
  all: ['{{camelName}}'] as const,
};

type Use{{PascalName}}MutationVariables = {{PascalName}}Payload;

export const use{{PascalName}}Mutation = () => {
  const queryClient = useQueryClient();

  return useMutation<{{PascalName}}Response, ApiError, Use{{PascalName}}MutationVariables>({
    mutationFn: variables => {
      logger.debug('[{{PascalName}}] mutationFn', variables);
      return fetch{{PascalName}}(variables);
    },
    meta: API_TOAST,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: {{camelName}}Keys.all });
      logger.info('[{{PascalName}}] Mutation succeeded', variables);
    },
    onError: (err, variables) => {
      logger.error('[{{PascalName}}] Mutation failed', {
        status: err.status,
        data: err.data,
        variables,
      });
    },
  });
};
