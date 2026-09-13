/**
 * Additional Swagger documentation examples
 * This file contains JSDoc comments that can be referenced in swagger.ts
 */

/**
 * @swagger
 * components:
 *   examples:
 *     DeviceListResponse:
 *       summary: Приклад відповіді зі списком пристроїв
 *       value:
 *         devices:
 *           - sn: "ABC123456789"
 *             deviceName: "Delta 3 Max Plus"
 *             deviceType: "DELTA_3_MAX_PLUS"
 *             online: 1
 *           - sn: "XYZ987654321"
 *             deviceName: "Delta 3 Plus"
 *             deviceType: "DELTA_3_PLUS"
 *             online: 0
 *         total: 2
 *     DeviceStatusResponse:
 *       summary: Приклад відповіді зі статусом пристрою
 *       value:
 *         deviceId: "ABC123456789"
 *         data:
 *           deviceId: "ABC123456789"
 *           batteryLevel: 85
 *           status: "charging"
 *           chargeRate: 120
 *           dischargeRate: 0
 *           timestamp: 1704451200000
 *         source: "mqtt"
 *         timestamp: 1704451200000
 *     ErrorResponse:
 *       summary: Приклад відповіді з помилкою
 *       value:
 *         error:
 *           message: "Device not found"
 *           code: "DEVICE_NOT_FOUND"
 */

