"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getDashboardMessages } from "@/lib/dashboard-messages";
import type { AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Combobox,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
} from "@/components/ui/combobox";

interface Member {
  userId: string;
  name: string | null;
  email: string;
}

interface DashboardUserFilterProps {
  members: Member[];
  activeUserIds: string[];
  locale: AppLocale;
}

export function DashboardUserFilter({
  members,
  activeUserIds,
  locale,
}: DashboardUserFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const messages = getDashboardMessages(locale);

  const label =
    activeUserIds.length === 0
      ? messages.filters.allMembers
      : activeUserIds.length === 1
        ? (members.find((m) => m.userId === activeUserIds[0])?.name ??
          members.find((m) => m.userId === activeUserIds[0])?.email ??
          messages.filters.memberFallback)
        : messages.filters.memberCount(activeUserIds.length);

  const handleChange = (values: string[]) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("user");
      values.forEach((v) => params.append("user", v));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <Combobox multiple value={activeUserIds} onValueChange={handleChange}>
      <ComboboxTrigger
        className={cn(
          buttonVariants({
            variant: activeUserIds.length > 0 ? "secondary" : "outline",
          }),
        )}
      >
        <User className="size-4" />
        {label}
      </ComboboxTrigger>
      <ComboboxPopup align="end" className="font-heading w-48">
        <ComboboxList>
          {members.map((member) => {
            const display = member.name ?? member.email;
            const initials = display.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <ComboboxItem key={member.userId} value={member.userId}>
                <Avatar className="size-5">
                  <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                </Avatar>
                {display}
              </ComboboxItem>
            );
          })}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
