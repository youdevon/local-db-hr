"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProfileSelfServiceBodyProps = {
  personal: ReactNode;
  contract: ReactNode;
  leave: ReactNode;
  qualifications: ReactNode;
};

export function ProfileSelfServiceBody({ personal, contract, leave, qualifications }: ProfileSelfServiceBodyProps) {
  return (
    <Tabs defaultValue="personal" className="gap-4">
      <TabsList variant="line" className="w-full flex-wrap justify-start">
        <TabsTrigger value="personal" className="px-3">
          Personal Information
        </TabsTrigger>
        <TabsTrigger value="contract" className="px-3">
          Contract
        </TabsTrigger>
        <TabsTrigger value="leave" className="px-3">
          Leave
        </TabsTrigger>
        <TabsTrigger value="qualifications" className="px-3">
          Qualifications
        </TabsTrigger>
      </TabsList>
      <TabsContent value="personal" className="mt-4">
        {personal}
      </TabsContent>
      <TabsContent value="contract" className="mt-4">
        {contract}
      </TabsContent>
      <TabsContent value="leave" className="mt-4">
        {leave}
      </TabsContent>
      <TabsContent value="qualifications" className="mt-4">
        {qualifications}
      </TabsContent>
    </Tabs>
  );
}
