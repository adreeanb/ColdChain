# 4. Usuários

Pasta: `src/controllers/user/` e `src/services/user/`. O login está em [Autenticação](03-autenticacao-e-permissoes.md).

Nenhuma resposta retorna o campo `password`: todos os services usam `select` com os campos permitidos.

---

## 4.1 Ver o próprio usuário — `GET /me`

`CurrentUserController` → `CurrentUserService`

- Usa `req.user.id` do token.
- Busca o usuário não excluído e retorna `{ id, name, email, role, enterpriseId, createdAt }`.

| Status | Quando |
|---|---|
| 200 | Usuário encontrado |
| 404 | "Usuário não encontrado." (ex.: excluído com token ainda válido) |

---

## 4.2 Editar o próprio perfil — `PUT /me`

`UpdateProfileController` → `UpdateProfileService`

**Corpo:** `{ name?, email? }` (papel e empresa não podem ser alterados aqui)

1. Busca o usuário pelo id do token.
2. Se o e-mail mudou, verifica com `findUnique` se já está em uso — `findUnique` enxerga usuários excluídos, então o e-mail de um usuário excluído continua reservado.
3. Atualiza só os campos enviados.

| Status | Quando |
|---|---|
| 200 | Perfil atualizado |
| 400 | "Usuário não encontrado." / "Este e-mail já está cadastrado." |

---

## 4.3 Trocar a própria senha — `PUT /me/password`

`ChangePasswordController` → `ChangePasswordService`

**Corpo:** `{ currentPassword, newPassword }`

```mermaid
flowchart TD
    A[PUT /me/password] --> B{currentPassword e<br/>newPassword informados?}
    B -- Não --> E1[400 Informe a senha atual e a nova senha]
    B -- Sim --> C{newPassword >= 8 caracteres?}
    C -- Não --> E2[400 A nova senha deve ter pelo menos 8 caracteres]
    C -- Sim --> D[Busca usuário do token]
    D --> F{bcrypt.compare<br/>senha atual confere?}
    F -- Não --> E3[400 A senha atual está incorreta]
    F -- Sim --> G[Grava hash bcrypt custo 8]
    G --> H[200 Senha alterada com sucesso]
```

---

## 4.4 Criar usuário — `POST /users` (ADMIN, MASTER)

`CreateUserController` → `CreateUserService`

**Corpo:** `{ name, email, password, role?, enterpriseId? }`
- `role` padrão: `OPERATOR`. Aceita apenas `ADMIN` ou `OPERATOR`.
- `enterpriseId` só é considerado se quem cria for MASTER (`resolveEnterpriseId`); para o ADMIN, o usuário é criado na própria empresa.

```mermaid
flowchart TD
    A[POST /users] --> B[enterpriseId = resolveEnterpriseId]
    B --> C{name, email e password?}
    C -- Não --> E1[400 Nome, e-mail e senha são obrigatórios]
    C -- Sim --> D{senha >= 8?}
    D -- Não --> E2[400 A senha deve ter pelo menos 8 caracteres]
    D -- Sim --> F{role é ADMIN ou OPERATOR?}
    F -- Não --> E3[400 Perfil de acesso inválido]
    F -- Sim --> G{Empresa existe<br/>e não excluída?}
    G -- Não --> E4[400 Empresa não encontrada ou desativada]
    G -- Sim --> H{E-mail já usado?<br/>inclui excluídos}
    H -- Sim --> E5[400 Este e-mail já está cadastrado]
    H -- Não --> I[Hash bcrypt custo 8]
    I --> J[Cria usuário]
    J --> K[201 id, name, email, role, enterpriseId, createdAt]
```

---

## 4.5 Listar usuários — `GET /users` (ADMIN, MASTER)

`ListUsersController` → `ListUsersService`

- Query opcional `?enterpriseId=` (só vale para o MASTER).
- Retorna os usuários não excluídos da empresa, em ordem alfabética: `{ id, name, email, role, createdAt }`.

---

## 4.6 Editar usuário — `PUT /users/:id` (ADMIN, MASTER)

`UpdateUserController` → `UpdateUserService`

**Corpo:** `{ name?, email?, role? }` — **Query:** `?enterpriseId=` (MASTER)

```mermaid
flowchart TD
    A[PUT /users/:id] --> B{Usuário existe na empresa<br/>e não excluído?}
    B -- Não --> E1[400 Usuário não encontrado ou não pertence à sua empresa]
    B -- Sim --> C{Alvo é MASTER e<br/>quem edita não é MASTER?}
    C -- Sim --> E2[400 Apenas um MASTER pode alterar outro MASTER]
    C -- Não --> D{role enviado e diferente do atual?}
    D -- Sim --> D1{Editando a si mesmo?}
    D1 -- Sim --> E3[400 Você não pode alterar o seu próprio perfil de acesso]
    D1 -- Não --> D2{role é ADMIN ou OPERATOR?}
    D2 -- Não --> E4[400 Perfil de acesso inválido]
    D2 -- Sim --> F
    D -- Não --> F{E-mail mudou?}
    F -- Sim --> F1{E-mail em uso?}
    F1 -- Sim --> E5[400 Este e-mail já está cadastrado]
    F1 -- Não --> G
    F -- Não --> G[Atualiza só os campos enviados]
    G --> H[200 id, name, email, role]
```

---

## 4.7 Excluir usuário — `DELETE /users/:id` (ADMIN, MASTER)

`DeleteUserController` → `DeleteUserService`

1. Não permite excluir a si mesmo.
2. O usuário precisa existir na empresa resolvida e não estar excluído.
3. Só um MASTER exclui outro MASTER.
4. Executa `prisma.user.delete`, que a extensão transforma em `isDeleted = true` (soft delete).

| Status | Quando |
|---|---|
| 200 | `{ message: "Usuário removido com sucesso." }` |
| 400 | "Você não pode excluir o seu próprio usuário." / "Usuário não encontrado ou não pertence à sua empresa." / "Apenas um MASTER pode excluir outro MASTER." |

O usuário excluído não consegue mais fazer login, mas um token emitido antes da exclusão segue válido até expirar.
