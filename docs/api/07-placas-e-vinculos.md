# 7. Placas e vínculos (Cold Unit Devices)

Pasta: `api/src/controllers/device/` e `api/src/services/device/`.

Uma **placa** (`ColdUnitDevice`) é um ESP32 identificado pelo endereço MAC e autenticado por uma chave própria. Ela pertence a uma empresa e pode ser **vinculada** a uma unidade fria. O vínculo é registrado em `AssociationHistory` com início e fim, então a placa pode mudar de unidade sem perder o histórico.

## Ciclo de vida da placa

```mermaid
stateDiagram-v2
    [*] --> Desconhecida: ESP32 ligado, MAC não cadastrado
    Desconhecida --> SemVinculo: POST /devices (MASTER) gera a chave
    SemVinculo --> Vinculada: POST /devices/bind (QR Code)
    Vinculada --> Vinculada: bind em outra unidade
    Vinculada --> SemVinculo: unbind ou unidade excluída
    SemVinculo --> Inativa: deactivate
    Vinculada --> Inativa: deactivate ou empresa excluída
    Inativa --> [*]

    note right of Desconhecida: leituras descartadas
    note right of SemVinculo: leituras na quarentena
    note right of Vinculada: leituras oficiais e alertas
    note right of Inativa: leituras descartadas
```

Em qualquer estado ativo, uma mensagem com chave errada é recusada.

## Normalização do MAC (`src/lib/macAddress.ts`)

`normalizeMacAddress(valor)`:
1. Rejeita valores que não são string.
2. Remove `:`, `-`, `.` e espaços e converte para maiúsculas.
3. Exige exatamente 12 dígitos hexadecimais.
4. Retorna no formato `AA:BB:CC:DD:EE:FF`, ou `null` se inválido.

Assim, `24-6f-28-aa-bb-cc`, `246F28AABBCC` e `24:6F:28:AA:BB:CC` representam a mesma placa. É usada no cadastro, no vínculo e na ingestão (inclusive no MAC extraído do tópico MQTT).

---

## 7.1 Cadastrar placa — `POST /devices` (MASTER)

`CreateDeviceController` → `CreateDeviceService`

**Corpo:** `{ "macAddress": "24:6F:28:AA:BB:CC", "enterpriseId": "<uuid>" }`

O MASTER cadastra a placa e define a empresa dona (o `enterpriseId` vem do corpo, sem `resolveEnterpriseId`, porque a rota já é exclusiva do MASTER).

```mermaid
flowchart TD
    A[POST /devices] --> B[normalizeMacAddress]
    B --> C{MAC válido?}
    C -- Não --> E1[400 Endereço MAC inválido]
    C -- Sim --> D{Empresa existe<br/>e não excluída?}
    D -- Não --> E2[400 Empresa não encontrada ou desativada]
    D -- Sim --> F{MAC já cadastrado?}
    F -- Sim --> E3[400 Já existe uma placa cadastrada com este MAC]
    F -- Não --> K[generateDeviceKey<br/>ck_ + 24 bytes aleatórios]
    K --> G[Cria ColdUnitDevice<br/>isActive = true<br/>apiKeyHash = SHA-256 da chave]
    G --> H[201 placa + deviceKey]
```

A resposta traz a placa e o campo `deviceKey`, **a única vez em que a chave aparece**. Ela deve ser colada no portal de configuração da placa (rede `ColdChain-XXXXXX`; ver `firmware/README.md`). A placa nasce ativa e sem vínculo: a partir daqui, as leituras com a chave certa deixam de ser descartadas e passam a ir para a quarentena.

## 7.2 Gerar nova chave — `POST /devices/:id/key` (MASTER)

`RotateDeviceKeyController` → `RotateDeviceKeyService`

Gera outra chave e grava o novo hash; a anterior deixa de valer imediatamente. Resposta `201 { deviceId, macAddress, deviceKey }`. Placa inexistente → `400 "Placa não encontrada."`. Serve para chave perdida, suspeita de vazamento ou para placas cadastradas antes da existência das chaves (que têm `apiKeyHash` nulo e não conseguem enviar dados).

---

## 7.3 Listar placas — `GET /devices`

`ListDevicesController` → `ListDevicesService`

**Query:** `?enterpriseId=` (só o MASTER), `?includeInactive=true` (inclui desativadas).

Para cada placa retorna (nunca o hash da chave):
- dados da placa, inclusive `lastSeenAt`, e o vínculo atual (`associations` com `endDate = null`, incluindo `coldUnit { id, name, type }`);
- `isOnline`: placa ativa e com `lastSeenAt` nos últimos `SENSOR_OFFLINE_MINUTES` (padrão 10);
- `offlineThresholdMinutes`.

`lastSeenAt` é a hora de **chegada** da última mensagem aceita, gravada pela ingestão. Vale também para leituras antigas, repetidas ou em quarentena, porque qualquer mensagem aceita prova que a placa está viva agora.

---

## 7.4 Placas aguardando vínculo — `GET /devices/unbound`

`ListUnboundDevicesService`

Agrupa a quarentena não expirada (`expiresAt > agora`) das placas da empresa do token e retorna, por placa:

```json
[
  {
    "deviceId": "…",
    "macAddress": "24:6F:28:AA:BB:CC",
    "pendingReadings": 42,
    "firstReadingAt": "2026-11-11T11:10:00.000Z",
    "lastReadingAt": "2026-11-11T13:10:00.000Z",
    "nextExpirationAt": "2026-11-11T13:15:00.000Z"
  }
]
```

O painel usa isso para mostrar placas ligadas que ainda não foram associadas a uma unidade, o período coberto pelas leituras retidas e quando as mais antigas expiram.

---

## 7.5 Vincular placa (QR Code) — `POST /devices/bind`

`BindDeviceController` → `BindDeviceService`

**Corpo:**
```json
{
  "macAddress": "<lido do QR Code>",
  "coldUnitId": "<uuid>",
  "quarantine": "recover",
  "recoverFrom": "2026-11-11T12:00:00Z"
}
```

| Campo | Obrigatório | Significado |
|---|---|---|
| `macAddress` | Sim | MAC lido do QR Code impresso na placa |
| `coldUnitId` | Sim | Unidade escolhida |
| `quarantine` | Não (padrão `recover`) | `recover`: as leituras retidas viram oficiais nesta unidade. `discard`: são apagadas, por exemplo quando a placa mediu na bancada antes da instalação |
| `recoverFrom` | Não | Com `recover`, recupera só as leituras a partir deste horário |

Qualquer usuário autenticado (inclusive OPERATOR) pode vincular, desde que placa e unidade sejam da empresa do token.

```mermaid
flowchart TD
    A[POST /devices/bind] --> B{MAC válido?}
    B -- Não --> E1[400 Endereço MAC inválido]
    B -- Sim --> Q{quarantine é<br/>recover ou discard?}
    Q -- Não --> E0[400 Escolha recuperar ou descartar]
    Q -- Sim --> R{recoverFrom<br/>é data válida?}
    R -- Não --> E5[400 Horário inválido]
    R -- Sim --> C{Placa da empresa<br/>e ativa?}
    C -- Não --> E2[400 Placa não encontrada...]
    C -- Sim --> D{Unidade da empresa<br/>e não excluída?}
    D -- Não --> E3[400 Unidade fria não encontrada...]
    D -- Sim --> T

    subgraph T [prisma.$transaction]
        L[lockDevice: espera leituras<br/>da placa em processamento] --> T0{Vínculo ativo já é<br/>com esta unidade?}
        T0 -- Sim --> R0[Retorna vínculo atual<br/>nada muda]
        T0 -- Não --> T1[Encerra vínculo ativo<br/>endDate = agora]
        T1 --> T2[Quarentena não expirada da placa]
        T2 --> T3[Limite inferior = maior entre<br/>fim do último vínculo e recoverFrom]
        T3 --> T4{recover?}
        T4 -- Sim --> T5[Recuperadas = leituras<br/>com timestamp >= limite]
        T4 -- Não --> T6[Recuperadas = nenhuma]
        T5 --> T7[Cria vínculo<br/>startDate = 1ª recuperada ou agora]
        T6 --> T7
        T7 --> T8[createMany TemperatureReading<br/>HISTORICAL, horário original<br/>skipDuplicates]
        T8 --> T9[applyReadingsToAlerts]
        T9 --> T10[Apaga da quarentena<br/>tudo o que foi lido]
    end

    T10 --> EV[publishEvent devices]
    EV --> OK[201 association,<br/>recoveredReadings, discardedReadings]
    T -- P2002 índice único parcial --> E4[400 Esta placa acabou de ser vinculada<br/>por outra requisição. Tente novamente.]
```

Detalhes:
- **Reescanear na mesma unidade** não cria histórico e não mexe na quarentena.
- **Sem sobreposição de vínculos**: nada anterior ao fim do último vínculo da placa é recuperado. Assim, dois vínculos nunca cobrem o mesmo horário e uma leitura nunca poderia pertencer a duas unidades.
- **Início do vínculo**: é o horário da primeira leitura recuperada (ou agora, se nada for recuperado). Assim, um dado atrasado do mesmo período que chegue depois cai nesta unidade, em vez de voltar para a quarentena.
- **Resgate**: as leituras recuperadas passam a pertencer à unidade como `HISTORICAL`, com o horário de medição original, e passam pela regra de episódios de alerta com os limites dessa unidade.
- **Descarte**: as leituras não recuperadas (por `discard`, por `recoverFrom` ou por serem anteriores ao último vínculo) são apagadas da quarentena; a resposta informa quantas em `discardedReadings`.
- **Concorrência**: o `lockDevice` (advisory lock do PostgreSQL por placa) faz uma leitura que esteja chegando esperar o fim do vínculo, e vice-versa; uma leitura que chega depois já encontra o vínculo novo. Dois binds simultâneos da mesma placa violariam o índice único parcial; o Prisma lança `P2002` e o service devolve uma mensagem amigável.
- Depois do commit, publica um evento `devices` para as telas abertas (ver [Tempo real](14-tempo-real.md)).

---

## 7.6 Desvincular placa — `POST /devices/:id/unbind`

`UnbindDeviceService`

Encerra (`endDate = agora`) o vínculo ativo da placa, filtrando pela empresa do token através da relação `device: { enterpriseId }`. Se nenhum vínculo for encerrado → `400 "Vínculo ativo não encontrado para esta placa."`. Sucesso → `200 { message: "Placa desvinculada com sucesso." }` e evento `devices`.

Depois disso, as leituras da placa voltam para a quarentena, e um alerta de placa sem sinal aberto para o vínculo é encerrado pelo job.

---

## 7.7 Desativar placa — `PATCH /devices/:id/deactivate` (MASTER)

`DeactivateDeviceService`

Em transação: `isActive = false` e encerra o vínculo ativo. O histórico de leituras e vínculos é mantido; a placa só deixa de aceitar dados e novos vínculos. Placa inexistente ou já inativa → `400 "Placa não encontrada ou já desativada."`. Publica um evento `devices`.

Não existe rota para reativar uma placa.

---

## 7.8 Histórico de vínculos da placa — `GET /devices/:id/associations`

Retorna os vínculos da placa (mais recente primeiro) com `coldUnit { id, name, type }`. A placa precisa ser da empresa do token, senão `404 "Placa não encontrada ou não pertence à sua empresa."`.
