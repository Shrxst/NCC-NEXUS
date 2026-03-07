jest.mock("../src/modules/fines/fine.repository", () => ({
  getAttendanceRecordByCadetDrill: jest.fn(),
  getLeaveByCadetDrill: jest.fn(),
  getFineByCadetDrill: jest.fn(),
  createFine: jest.fn(),
  updateFine: jest.fn(),
  createFineEvent: jest.fn(),
  notifyCadet: jest.fn(),
}));

const repo = require("../src/modules/fines/fine.repository");
const service = require("../src/modules/fines/fine-eligibility.service");

describe("FineEligibilityService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("absent_no_leave_fine_created", async () => {
    repo.getAttendanceRecordByCadetDrill.mockResolvedValue({ status: "A" });
    repo.getLeaveByCadetDrill.mockResolvedValue(null);
    repo.getFineByCadetDrill.mockResolvedValue(null);
    repo.createFine.mockResolvedValue({ fine_id: 1, status: "pending" });

    const result = await service.applyFineDecisionTx({
      trx: {},
      regimentalNo: "REG001",
      drillId: 1001,
      actorUserId: 21,
    });

    expect(result.action).toBe("created");
    expect(repo.createFine).toHaveBeenCalledTimes(1);
    expect(repo.createFineEvent).toHaveBeenCalledWith(
      expect.objectContaining({ fineId: 1, eventType: "created" })
    );
  });

  test("absent_rejected_leave_fine_created", async () => {
    repo.getAttendanceRecordByCadetDrill.mockResolvedValue({ status: "A" });
    repo.getLeaveByCadetDrill.mockResolvedValue({ status: "rejected" });
    repo.getFineByCadetDrill.mockResolvedValue(null);
    repo.createFine.mockResolvedValue({ fine_id: 2, status: "pending" });

    const result = await service.applyFineDecisionTx({
      trx: {},
      regimentalNo: "REG002",
      drillId: 1002,
      actorUserId: 21,
    });

    expect(result.action).toBe("created");
    expect(repo.createFine).toHaveBeenCalledTimes(1);
  });

  test("approved_leave_no_fine", async () => {
    repo.getAttendanceRecordByCadetDrill.mockResolvedValue({ status: "A" });
    repo.getLeaveByCadetDrill.mockResolvedValue({ status: "approved" });
    repo.getFineByCadetDrill.mockResolvedValue(null);

    const result = await service.applyFineDecisionTx({
      trx: {},
      regimentalNo: "REG003",
      drillId: 1003,
      actorUserId: 21,
    });

    expect(result.action).toBe("none");
    expect(repo.createFine).not.toHaveBeenCalled();
    expect(repo.updateFine).not.toHaveBeenCalled();
  });

  test("late_leave_approval_reverses_fine", async () => {
    repo.getAttendanceRecordByCadetDrill.mockResolvedValue({ status: "A" });
    repo.getLeaveByCadetDrill.mockResolvedValue({ status: "approved" });
    repo.getFineByCadetDrill.mockResolvedValue({ fine_id: 4, status: "pending" });
    repo.updateFine.mockResolvedValue({ fine_id: 4, status: "cancelled" });

    const result = await service.applyFineDecisionTx({
      trx: {},
      regimentalNo: "REG004",
      drillId: 1004,
      actorUserId: 21,
    });

    expect(result.action).toBe("reversed");
    expect(repo.updateFine).toHaveBeenCalledWith(
      expect.objectContaining({ fineId: 4, patch: { status: "cancelled" } })
    );
    expect(repo.createFineEvent).toHaveBeenCalledWith(
      expect.objectContaining({ fineId: 4, eventType: "reversed" })
    );
  });

  test("attendance_change_removes_fine", async () => {
    repo.getAttendanceRecordByCadetDrill.mockResolvedValue({ status: "P" });
    repo.getLeaveByCadetDrill.mockResolvedValue({ status: "rejected" });
    repo.getFineByCadetDrill.mockResolvedValue({ fine_id: 5, status: "pending" });
    repo.updateFine.mockResolvedValue({ fine_id: 5, status: "cancelled" });

    const result = await service.applyFineDecisionTx({
      trx: {},
      regimentalNo: "REG005",
      drillId: 1005,
      actorUserId: 21,
    });

    expect(result.action).toBe("reversed");
    expect(repo.updateFine).toHaveBeenCalledTimes(1);
  });
});
