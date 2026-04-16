"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, ChevronDown } from "lucide-react";

interface Member {
  userId: string;
  name: string | null;
  email: string;
}

interface DashboardUserFilterProps {
  members: Member[];
  activeUserId?: string;
}

export function DashboardUserFilter({
  members,
  activeUserId,
}: DashboardUserFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeUser = activeUserId
    ? members.find((m) => m.userId === activeUserId)
    : null;

  const handleUserChange = (value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete("user");
      } else {
        params.set("user", value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={activeUserId ? "secondary" : "outline"}>
          <User data-icon="inline-start" />
          {activeUser ? (
            <span>{activeUser.name ?? activeUser.email}</span>
          ) : (
            <span>Tous les membres</span>
          )}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Membre</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={activeUserId ?? "all"}
          onValueChange={handleUserChange}
        >
          <DropdownMenuRadioItem value="all">
            Tous les membres
          </DropdownMenuRadioItem>
          {members.map((member) => (
            <DropdownMenuRadioItem
              key={member.userId}
              value={member.userId}
            >
              {member.name ?? member.email}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
