import axios from 'axios';

export interface Artifact {
    [key: string]: unknown;
    id: string;
    projectId?: string;
    scanDate?: string;
    rawScan?: string;
    arData?: string;
    video?: string;
}

export interface Pagination {
    currentPage: number;
    from: number;
    lastPage: number;
    perPage: number;
    to: number;
    total: number;
}

export interface ApiResponse {
    data: Artifact[];
    pagination: Pagination;
}

export async function fetchScanArtifacts(domain: string, page: number): Promise<ApiResponse> {
    const url = `https://api.${domain}/spatial/v1/scan-artifacts?page=${page.toString()}`;
    const res = await axios.get<ApiResponse>(url);
    return res.data;
}
