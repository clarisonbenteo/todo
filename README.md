# TODO Kanban Manager

Um gestor de tarefas pessoal (estilo Kanban) com design minimalista, suporte completo a Drag & Drop e sincronização direta com banco de dados na nuvem (Supabase). A interface foi meticulosamente desenhada tendo como base o visual noturno do *GitHub Projects* aliado às diretrizes premium do **Apple Human Interface Guidelines (HIG)**.

## 🔗 Links e Acessos
- **Projeto em Produção:** [https://todo-casb.vercel.app](https://todo-casb.vercel.app)

---

## ✨ Funcionalidades Principais

- **Drag and Drop Total:** Mova livremente os cartões entre as 5 raias de estágio (Backlog, Ready, In progress, In review, Done).
- **Ordenação Dinâmica de Prioridades:** Arraste um cartão acima ou abaixo do outro *dentro da mesma coluna* para ditar a prioridade de execução.
- **Sistema de Prioridades por Cores (Semaforização):** 
  - 🔴 **Alto** (Fundo Vermelho Claro)
  - 🟡 **Médio** (Fundo Amarelo)
  - 🟢 **Baixo** (Fundo Verde)
- **Controle de Prazos (Due Dates):** Data de vencimento em cada tarefa. Caso a data já tenha passado, o indicador automaticamente fica na cor de atenção (Vermelho).
- **Modais Elegantes:** Formulários sobrepostos (*Glassmorphism*) para Adicionar ou Editar as tarefas sem depender de pop-ups feios do navegador.
- **Sincronização Cloud:** Totalmente integrado ao Supabase para que todas as suas tarefas sejam imortais e carreguem instantaneamente.
- **Modo Dark e Light:** Suporte a chaveamento de temas nativo e livre de "flashes" (via `next-themes`).

---

## 🛠 Tecnologias Utilizadas

- **[Next.js](https://nextjs.org/)** - React Framework (App Router).
- **[Supabase](https://supabase.com/)** - Backend as a Service e PostgreSQL.
- **[@hello-pangea/dnd](https://github.com/hello-pangea/dnd)** - Biblioteca hiper-otimizada e fluída para interações de "Arrastar e Soltar".
- **[Lucide-React](https://lucide.dev/)** - Biblioteca de ícones modernos.
- **Vanilla CSS** - Utilizando Tokens CSS customizados (`globals.css`) e arquitetura simplificada sem a poluição do Tailwind.

---

## 💻 Como Rodar o Projeto Localmente

1. Clone este repositório:
   ```bash
   git clone https://github.com/clarisonbenteo/todo.git
   ```
2. Instale as dependências:
   ```bash
   cd todo
   npm install
   ```
3. Crie um arquivo `.env.local` na raiz com as suas credenciais do Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=seu_url_do_projeto
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
   ```
4. Rode as querys no Supabase (SQL Editor) para garantir que as tabelas existam:
   ```sql
   create table public.todo_tasks (
     id uuid default gen_random_uuid() primary key,
     title text not null,
     description text,
     column_id text not null,
     position integer not null,
     tags text[] default '{}',
     due_date date,
     created_at timestamp with time zone default timezone('utc'::text, now()) not null
   );
   
   -- Permissões
   alter table public.todo_tasks enable row level security;
   create policy "Enable all access for all users" on public.todo_tasks for all using (true) with check (true);
   ```
5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
6. Acesse [http://localhost:3000](http://localhost:3000)

---
*Construído e Refinado com o Auxílio do Google Antigravity.*
