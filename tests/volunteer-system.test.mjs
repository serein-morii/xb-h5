import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("registers fish-slice volunteer as a peer system", async () => {
  const [paths, routes, home] = await Promise.all([
    read("app/lib/pathConventions.ts"),
    read("app/systems/volunteer/routes.tsx"),
    read("app/systems/home/SystemHome.tsx"),
  ]);
  assert.match(paths, /volunteer: "\/volunteer"/);
  assert.match(paths, /volunteerJoin: "\/volunteer\/join"/);
  assert.match(routes, /VolunteerHome/);
  assert.match(routes, /VolunteerJoin/);
  assert.match(routes, /VolunteerAdmin/);
  assert.match(home, /name: "鱼片志愿"/);
});

test("keeps identity and consent handling explicit in the registration UI", async () => {
  const join = await read("app/systems/volunteer/VolunteerJoin.tsx");
  assert.match(join, /身份证号/);
  assert.match(join, /加密保存/);
  assert.match(join, /acceptedCommitment/);
  assert.match(join, /服务承诺书/);
  assert.match(join, /5 \* 1024 \* 1024/);
  assert.match(join, /body\.append\("application"/);
  assert.doesNotMatch(join, /\/photos/);
});

test("provides application review and member archive views", async () => {
  const admin = await read("app/systems/volunteer/VolunteerAdmin.tsx");
  assert.match(admin, /登记审核/);
  assert.match(admin, /会员档案/);
  assert.match(admin, /\/applications\/\$\{reviewing\.id\}\/review/);
  assert.match(admin, /pageSize: 20/);
});
