import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@databricks/appkit-ui/react';
import { TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/** The page a route shows when it fails to load or render. Every route in the router names it as its errorElement. */
export function RouteError() {
  const error = useRouteError();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>This page failed to load</EmptyTitle>
        <EmptyDescription>{describe(error)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
