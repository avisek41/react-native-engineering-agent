# Validate Integration

Verify that UI components remain free of direct API networking and all screen hooks follow integration standards.

## Steps
1. Run static validation:
   ```bash
   node agents/integration-agent/integration-agent.js validate ./src/screens
   ```
2. Verify zero occurrences of `axios`, `fetch`, or `useQuery` inside `.tsx` files.
3. Run TypeScript compiler: `npx tsc --noEmit`.
4. Ensure all error states and empty states have user feedback.
