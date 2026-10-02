import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptsMaterials,
  parseQuantity,
  parseDate,
  canAdvance,
} from "../src/utils/domain.js";

test("peso aceita vírgula decimal e rejeita zero, negativos e texto", () => {
  assert.equal(parseQuantity("4,5"), 4.5);
  for (const value of ["", "0", "-3", "abc", "Infinity"])
    assert.equal(parseQuantity(value), null);
});
test("destino precisa receber todos os materiais e estar ativo", () => {
  const point = { active: true, materials: ["paper", "plastic"] };
  assert.equal(acceptsMaterials(point, ["paper", "plastic"]), true);
  assert.equal(acceptsMaterials(point, ["paper", "glass"]), false);
  assert.equal(acceptsMaterials({ ...point, active: false }, ["paper"]), false);
});
test("agendamento rejeita data passada e dia impossível", () => {
  assert.equal(parseDate("31/02/2099"), null);
  assert.equal(parseDate("01/01/2000"), null);
  assert.equal(parseDate("2099-01-01"), null);
  assert.ok(parseDate("01/01/2099") instanceof Date);
  const today = new Date();
  const input = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  assert.ok(parseDate(input) instanceof Date);
});
test("só o motorista atribuído registra retirada e entrega", () => {
  const request = { status: 1, driverId: "driver1", pointId: "p1" };
  assert.equal(canAdvance(request, "driver", "driver1", []), true);
  assert.equal(
    canAdvance({ ...request, status: 2 }, "driver", "driver1", []),
    true,
  );
  assert.equal(canAdvance(request, "driver", "driver2", []), false);
  assert.equal(canAdvance(request, "resident", "driver1", []), false);
  assert.equal(
    canAdvance({ ...request, cancelled: true }, "driver", "driver1", []),
    false,
  );
});
test("apenas o ponto proprietário confirma recebimento após entrega", () => {
  const request = { status: 3, driverId: "driver1", pointId: "p1" };
  assert.equal(canAdvance(request, "driver", "driver1", []), false);
  assert.equal(canAdvance(request, "point", "owner", ["p1"]), true);
  assert.equal(canAdvance(request, "point", "other", ["p2"]), false);
  assert.equal(
    canAdvance({ ...request, status: 2 }, "point", "owner", ["p1"]),
    false,
  );
  assert.equal(
    canAdvance({ ...request, status: 4 }, "point", "owner", ["p1"]),
    false,
  );
});
