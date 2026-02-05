import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().describe("姓名"),
  gender: z.string().nullable().optional().describe("性别"),
  birth_date: z.string().nullable().optional().describe("出生日期"),
  company: z.string().nullable().optional().describe("公司"),
  title: z.string().nullable().optional().describe("职位"),
  phone: z.string().nullable().optional().describe("手机号"),
  wechat: z.string().nullable().optional().describe("微信号"),
  tags: z.array(z.string()).nullable().optional().describe("标签"),
});

export const diarySchema = z.object({
  date: z.string().describe("日期"),
  mood: z.string().nullable().optional().describe("心情"),
  content: z.string().describe("日记内容"),
  tags: z.array(z.string()).nullable().optional().describe("标签"),
});

export const kbSchema = z.object({
  title: z.string().describe("标题"),
  content: z.string().describe("正文"),
  tags: z.array(z.string()).nullable().optional().describe("标签"),
});
