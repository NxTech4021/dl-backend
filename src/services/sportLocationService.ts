import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface Sport {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSportInput {
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateLocationInput {
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}

class SportLocationService {
  // Sports management
  async getActiveSports(): Promise<Sport[]> {
    // For now, return hardcoded sports until we add Sport table to schema
    const defaultSports: Sport[] = [
      {
        id: "tennis",
        name: "Tennis",
        code: "TENNIS",
        description: "Individual or doubles racquet sport",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "badminton",
        name: "Badminton",
        code: "BADMIN",
        description: "Racquet sport played on a court",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "squash",
        name: "Squash",
        code: "SQUASH",
        description: "Racquet sport played in an enclosed court",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "table-tennis",
        name: "Table Tennis",
        code: "TTENNIS",
        description: "Indoor racquet sport",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "pickleball",
        name: "Pickleball",
        code: "PICKLE",
        description: "Paddle sport combining tennis, badminton and ping-pong",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "basketball",
        name: "Basketball",
        code: "BBALL",
        description: "Team sport played on a court with hoops",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "volleyball",
        name: "Volleyball",
        code: "VBALL",
        description: "Team sport played with a net",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "soccer",
        name: "Soccer (Football)",
        code: "SOCCER",
        description: "Team sport played with a ball and goals",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return defaultSports;
  }

  async getAllSports(): Promise<Sport[]> {
    // Return all sports including inactive ones
    const activeSports = await this.getActiveSports();
    const inactiveSports: Sport[] = [
      {
        id: "cricket",
        name: "Cricket",
        code: "CRICKET",
        description: "Bat-and-ball game",
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return [...activeSports, ...inactiveSports];
  }

  async getSportByCode(code: string): Promise<Sport | null> {
    const sports = await this.getAllSports();
    return sports.find(sport => sport.code.toLowerCase() === code.toLowerCase()) || null;
  }

  async getSportByName(name: string): Promise<Sport | null> {
    const sports = await this.getAllSports();
    return sports.find(sport => sport.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async validateSport(sportInput: string): Promise<boolean> {
    const sports = await this.getActiveSports();
    return sports.some(sport =>
      sport.name.toLowerCase() === sportInput.toLowerCase() ||
      sport.code.toLowerCase() === sportInput.toLowerCase()
    );
  }

  // Locations management
  async getActiveLocations(): Promise<Location[]> {
    // For now, return hardcoded locations until we add Location table to schema
    const defaultLocations: Location[] = [
      {
        id: "downtown-sports-center",
        name: "Downtown Sports Center",
        code: "DSC",
        address: "123 Main Street",
        city: "Downtown",
        state: "State",
        country: "Country",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "north-recreational-complex",
        name: "North Recreational Complex",
        code: "NRC",
        address: "456 North Avenue",
        city: "North District",
        state: "State",
        country: "Country",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "east-community-center",
        name: "East Community Center",
        code: "ECC",
        address: "789 East Boulevard",
        city: "East Side",
        state: "State",
        country: "Country",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "west-sports-club",
        name: "West Sports Club",
        code: "WSC",
        address: "321 West Street",
        city: "West End",
        state: "State",
        country: "Country",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "central-arena",
        name: "Central Arena",
        code: "CA",
        address: "555 Central Plaza",
        city: "City Center",
        state: "State",
        country: "Country",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "university-sports-facility",
        name: "University Sports Facility",
        code: "USF",
        address: "777 Campus Drive",
        city: "University District",
        state: "State",
        country: "Country",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return defaultLocations;
  }

  async getAllLocations(): Promise<Location[]> {
    // Return all locations including inactive ones
    const activeLocations = await this.getActiveLocations();
    const inactiveLocations: Location[] = [
      {
        id: "old-gymnasium",
        name: "Old Gymnasium",
        code: "OG",
        address: "999 Old Road",
        city: "Old Town",
        state: "State",
        country: "Country",
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return [...activeLocations, ...inactiveLocations];
  }

  async getLocationByCode(code: string): Promise<Location | null> {
    const locations = await this.getAllLocations();
    return locations.find(location => location.code.toLowerCase() === code.toLowerCase()) || null;
  }

  async getLocationByName(name: string): Promise<Location | null> {
    const locations = await this.getAllLocations();
    return locations.find(location => location.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async validateLocation(locationInput: string): Promise<boolean> {
    const locations = await this.getActiveLocations();
    return locations.some(location =>
      location.name.toLowerCase() === locationInput.toLowerCase() ||
      location.code.toLowerCase() === locationInput.toLowerCase()
    );
  }

  // Search functionality
  async searchSports(query: string): Promise<Sport[]> {
    const sports = await this.getActiveSports();
    const lowercaseQuery = query.toLowerCase();

    return sports.filter(sport =>
      sport.name.toLowerCase().includes(lowercaseQuery) ||
      sport.code.toLowerCase().includes(lowercaseQuery) ||
      (sport.description && sport.description.toLowerCase().includes(lowercaseQuery))
    );
  }

  async searchLocations(query: string): Promise<Location[]> {
    const locations = await this.getActiveLocations();
    const lowercaseQuery = query.toLowerCase();

    return locations.filter(location =>
      location.name.toLowerCase().includes(lowercaseQuery) ||
      location.code.toLowerCase().includes(lowercaseQuery) ||
      (location.city && location.city.toLowerCase().includes(lowercaseQuery)) ||
      (location.address && location.address.toLowerCase().includes(lowercaseQuery))
    );
  }

  // Validation helpers for league creation
  async validateLeagueInputs(sport: string, location: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    const isSportValid = await this.validateSport(sport);
    if (!isSportValid) {
      errors.push(`Invalid sport: ${sport}. Please select from available sports.`);
    }

    const isLocationValid = await this.validateLocation(location);
    if (!isLocationValid) {
      errors.push(`Invalid location: ${location}. Please select from available locations.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Get dropdown options for frontend
  async getSportOptions(): Promise<Array<{ value: string; label: string; description?: string }>> {
    const sports = await this.getActiveSports();
    return sports.map(sport => {
      const option: { value: string; label: string; description?: string } = {
        value: sport.name,
        label: sport.name,
      };
      if (sport.description) {
        option.description = sport.description;
      }
      return option;
    });
  }

  async getLocationOptions(): Promise<Array<{ value: string; label: string; address?: string }>> {
    const locations = await this.getActiveLocations();
    return locations.map(location => {
      const option: { value: string; label: string; address?: string } = {
        value: location.name,
        label: location.name,
      };
      if (location.address) {
        option.address = location.address;
      }
      return option;
    });
  }

  // Future: When we add Sport and Location tables to the database schema
  // These methods would interact with the actual database tables

  /*
  async createSport(data: CreateSportInput): Promise<Sport> {
    return await prisma.sport.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
    });
  }

  async createLocation(data: CreateLocationInput): Promise<Location> {
    return await prisma.location.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateSport(id: string, data: Partial<CreateSportInput>): Promise<Sport> {
    return await prisma.sport.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async updateLocation(id: string, data: Partial<CreateLocationInput>): Promise<Location> {
    return await prisma.location.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async deleteSport(id: string): Promise<void> {
    await prisma.sport.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deleteLocation(id: string): Promise<void> {
    await prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
  }
  */
}

export const sportLocationService = new SportLocationService();