import { CourtsController } from '../../src/modules/courts/courts.controller';

describe('CourtsController (unit)', () => {
  it('delegates find/create methods to CourtsService', async () => {
    const courtsService = {
      findNearby: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'c1' }),
      create: jest.fn().mockResolvedValue({ id: 'c2' }),
    };
    const controller = new CourtsController(courtsService as any);

    await controller.findNearby({ lat: 48.8 } as any);
    await controller.findById('c1');
    await controller.create({ name: 'Court' } as any);

    expect(courtsService.findNearby).toHaveBeenCalledTimes(1);
    expect(courtsService.findById).toHaveBeenCalledWith('c1');
    expect(courtsService.create).toHaveBeenCalledTimes(1);
  });
});
