import { useEffect, useState } from "react";

export interface UserTableRow {
  id: string;
  name: string;
  email: string;
  status: "active" | "paused";
}

export interface UserTableQueryState {
  isLoading: boolean;
  rows: UserTableRow[];
}

const DEFAULT_ROWS: UserTableRow[] = [
  { id: "u_1", name: "Mina Kim", email: "mina@example.com", status: "active" },
  { id: "u_2", name: "Jay Park", email: "jay@example.com", status: "paused" },
  { id: "u_3", name: "Sora Han", email: "sora@example.com", status: "active" },
];

export function useUserTableQuery(query: string): UserTableQueryState {
  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState<UserTableRow[]>(DEFAULT_ROWS);

  useEffect(() => {
    setIsLoading(true);
    const normalizedQuery = query.trim().toLowerCase();
    const timer = setTimeout(() => {
      setRows(
        normalizedQuery
          ? DEFAULT_ROWS.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(normalizedQuery))
          : DEFAULT_ROWS,
      );
      setIsLoading(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [query]);

  return {
    isLoading,
    rows,
  };
}
