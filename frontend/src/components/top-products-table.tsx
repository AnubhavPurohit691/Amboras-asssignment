'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  revenue: number;
  units_sold: number;
}

interface TopProductsTableProps {
  products: Product[];
  loading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function TopProductsTable({ products, loading }: TopProductsTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Products</CardTitle>
        <CardDescription>Ranked by revenue in selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-muted-foreground text-xs uppercase tracking-wider">#</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Product</TableHead>
              <TableHead className="text-right text-muted-foreground text-xs uppercase tracking-wider">Revenue</TableHead>
              <TableHead className="text-right text-muted-foreground text-xs uppercase tracking-wider">Units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, i) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {product.name}
                </TableCell>
                <TableCell className="text-right font-mono text-foreground font-medium">
                  {formatCurrency(product.revenue)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {product.units_sold}
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No purchase data yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
