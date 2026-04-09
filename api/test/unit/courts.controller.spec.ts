import { CourtsController } from '../../src/modules/courts/courts.controller';

describe('CourtsController (unit)', () => {
  const courtsService = {
    findById: jest.fn().mockResolvedValue({ id: 'c1' }),
    create: jest.fn().mockResolvedValue({ id: 'c2' }),
  };
  const controller = new CourtsController(courtsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates findById to CourtsService with correct id', async () => {
    await controller.findById('c1');
    expect(courtsService.findById).toHaveBeenCalledWith('c1');
  });

  it('delegates create to CourtsService with dto', async () => {
    const dto = { name: 'Court A', type: 'outdoor', lat: 48.8, lng: 2.3 };
    await controller.create(dto as any);
    expect(courtsService.create).toHaveBeenCalledWith(dto);
  });
});
